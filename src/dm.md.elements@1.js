/**************************************************
 * DmMarkdown 1.0 - Работа с markdown разметкой   *
 * Объектная модель документа - основные элементы *
 **************************************************/
(function (global, factory)
{
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory()
	: typeof define === 'function' && define.amd				 ? define(factory)
	: (global = typeof globalThis !== 'undefined'				 ? globalThis 
	: global || self, (global.DmMD || (global.DmMD = {})).elements = factory());
})(this, function ()
{
	'use strict';
	
	//#region Block elements

	// Горизонтальные разделители
	function HR(context)
	{
		const m					= (/^[> ]*(([-*=])[ ]{0,2})\1{1,2}\2[ ]*$/).exec(context.str);
		if (!m) return null;

		return {
			type				: 'HR',
		};
	}

	// Поиск заголовков
	function H(context)
	{
		const m					= (/^(#{1,6}) (.+?)( \1)?$/).exec(context.str);
		if (!m) return null;

		const _text				= m[2];
		return {
			type				: 'H',
			lvl					: m[1].length,
			fin					: function(parseFx) { this.items = parseFx(_text); }
		};
	}

	// Цитата 
	function QUOTE(context)
	{
		const str				= context.str;
		if (str[0]!=='>' || str[1]!==' ') return null;
		context.str				= str.substr(2);

		const el				= context.fx();
		return {
			type				: 'QUOTE',
			items				: el ? [ el ] : [],
			enter				: function (ctx, addFx, newFx)
			{
				const str		= ctx.str;
				const trim		= str[0]==='>';
				if (trim || ctx.emptyLines===0)
				{
					if (trim) ctx.str 	= str.substr(str[1]===' ' ? 2 : 1);
					if (!ctx.str)
					{
						ctx.resetEmptyLines	= false;
						ctx.emptyLines++;
						return this;
					}
					
					let last	= this.items[this.items.length-1];
					if (last && last.enter && (last = last.enter(ctx, (el) => (el && this.items.push(el) || el), newFx))) return last;
					
					return (last=newFx()) && this.items.push(last) || last;
				}

				return null;
			},
		};
	}

	const alertRe				= /^> \[!(NOTE|IMPORTANT|WARNING)\]\s*$/;
	// Блоки с важной информацией
	function ALERT(context)
	{
		const m					= alertRe.exec(context.str);
		if (!m) return null;

		context.str				= '> ';
		const el				= QUOTE(context);
		const enterFx			= el.enter;
		el.type					= 'ALERT';
		el.alert				= m[1].toLowerCase();
		el.enter				= function (ctx, addFx, newFx)
		{
			return alertRe.test(ctx.str) ? null : enterFx.call(this, ctx, addFx, newFx);
		};
		return el;
	}

	// Поиск продолжения числового списка
	const nextOLI				= /^( {0,3}(\d+[\.]?|#[\.]?) +(.*))$|^( {1,4}(.*))$/;
	// Поиск продолжения нечислового списка
	const nextULI				= /^( {0,3}(-|\+|\*|=) +(.*))$|^( {1,4}(.*))$/;
	// Списки
	function LIST(context)
	{
		const m					= (/^ {0,3}(\d+[\.]?|-|\+|\*|=|#[\.]?) +(.*)$/).exec(context.str);
		if (!m) return null;
		context.str				= m[2];

		return {
			type				: '-=*+'.indexOf(m[1])<0 ? 'OL' : 'UL',
			items				: [ 
				{
					type		: 'LI',
					items		: [ context.fx() ],
				}
			],
			enter				: function (ctx, addFx, newFx)
			{
				const str		= ctx.str;
				const next		= (this.type==='OL' ? nextOLI : nextULI).exec(str);
				const trim		= !next && (/^\s{1,4}/).exec(str);
				if (next || trim)
				{
					if (next)
					{
						ctx.str = next[3] || next[5];
						if (next[2]) this.items.push({ type: 'LI', items: [] });
					} else if (trim)
					{
						ctx.str = str.substr(m[0].length);
					}
					if (!ctx.str)
					{
						ctx.resetEmptyLines		= false;
						ctx.emptyLines++;
						return this;
					}
					
					const lastLI		= this.items[this.items.length-1];
					let last			= lastLI.items[lastLI.items.length-1];
					if (last && last.enter && (last = last.enter(ctx, (el) => (el && lastLI.items.push(el) || el), newFx))) return last;
					
					return (last=newFx()) && lastLI.items.push(last) || last;
				}

				return null;
			},
		};
	}

	// Блоки кода
	function CODEBLOCK(context)
	{
		const m					= (/^```\s*([a-z0-9\-]*)\s*$/i).exec(context.str);
		if (!m) return null;

		let _started			= true;
		return {
			type				: 'CODEBLOCK',
			code				: m[1],
			text				: '',
			enter				: function (ctx, addFx, newFx)
			{
				if (_started!==true) return null;

				const str		= ctx.str;
				if ((/^\s*```+\s*$/i).test(str)) 
					_started	= false;
				else if (str)
					this.text	+= ( this.text && '\n')+str;
				
				return this;
			}
		};
	}

	// По умолчанию - параграф
	function P(context)
	{
		if (!context.str) return null;

		return {
			type				: 'P',
			_text				: context.str,
			enter				: function (ctx, addFx, newFx)
			{
				const block		= newFx();
				if (block.type!=='P' || ctx.emptyLines>0) return addFx(block);
								
				this._text		+= '\n'+block._text;
				return this;
			},
			fin					: function(parseFx) { this.items = parseFx(this._text); delete this._text; }
		};
	}

	//#endregion

	//#region Inline elements

	function _brText(w)
	{
		w('\n');
	}

	function _codeText(w)
	{
		w('[', this.text, ']');
	}
	
	function _itemsText(w)
	{
		const items				= this.items;
		for	(let i=0; i<items.length; i++)
		{
			const item			= items[i];
			if (typeof(item)==='string') w(item);
			else if (item.toText) item.toText(w);
		}
	}

	// Код
	function CODE(ctx)
	{
		return ctx.str.replace(/`((``|[^`])+)`/g, (m, txt) => ctx.push({ type: 'CODE', text: txt.replace(/``/g, '`'), toText: _codeText }));
	}

	// Стандартный перенос строки (два пробела + \n)
	function StandardBR(ctx)
	{
		return ctx.str.replace(/\s{2,}\n/g, (m) => ctx.push({ type: 'BR', toText: _brText }));
	}

	// Упрощенный перенос строки
	function SimpleBR(ctx)
	{
		return ctx.str.replace(/\s*\n/g, (m) => ctx.push({ type: 'BR', toText: _brText }));
	}

	// Выделенный текст
	function EM(ctx)
	{
		return ctx.str
				  .replace(/(\*\*\*|___)(?=\S)([^\r]*?\S)\1/g, (m, lvl, txt) => ctx.push({ type: 'EM', lvl: 3, items: ctx.parse(txt), toText: _itemsText }))
				  .replace(/(\*\*|__)(?=\S)([^\r]*?\S)\1/g,    (m, lvl, txt) => ctx.push({ type: 'EM', lvl: 2, items: ctx.parse(txt), toText: _itemsText }))
				  .replace(/(\*|_)(?=\S)([^\r]*?\S)\1/g,       (m, lvl, txt) => ctx.push({ type: 'EM', lvl: 1, items: ctx.parse(txt), toText: _itemsText })); 
	}

	// Удаленный текст
	function DEL(ctx)
	{
		return ctx.str.replace(/(~~)(?=\S)([^\r]*?\S)\1/g, (m, start, txt) => ctx.push({ type: 'DEL', items: ctx.parse(txt) })); 
	}

	// Выделенный текст
	function MARK(ctx)
	{
		return ctx.str.replace(/(==)(?=\S)([^\r]*?\S)\1/g, (m, start, txt) => ctx.push({ type: 'MARK', items: ctx.parse(txt) })); 
	}

	// Подстрочный/надстрочный
	function SUBSUP(ctx)
	{
		return ctx.str
				  .replace(/(~)(?=\S)([^\r]*?\S)\1/g,  (m, start, txt) => ctx.push({ type: 'SUB', items: ctx.parse(txt), toText: _itemsText }))
				  .replace(/<sub>(?=\S)([^\r]*?\S)<\/sub>/g,  (m, txt) => ctx.push({ type: 'SUB', items: ctx.parse(txt), toText: _itemsText }))
				  .replace(/(\^)(?=\S)([^\r]*?\S)\1/g, (m, start, txt) => ctx.push({ type: 'SUP', items: ctx.parse(txt), toText: _itemsText }))
				  .replace(/<sup>(?=\S)([^\r]*?\S)<\/sup>/g,  (m, txt) => ctx.push({ type: 'SUP', items: ctx.parse(txt), toText: _itemsText })); 
	}

	// Простые ссылки <http://example.com> -> [http://example.com][#N]
	function EasyLink(ctx)
	{
		return ctx.str.replace(/<((?=~?\/|\S+([:@]))\S+)>/g, (m, url, d) => ['[', url, '][', ctx.addUrl(null, d==='@' ? 'mailto:'+url : url), ']'].join(''));
	}

	// Ссылки в тексте [Text](http://example.com) -> [Text][#N]
	function InlineLink(ctx)
	{
		return ctx.str.replace(/\[([^\]]*)\]\(([^)]+)\)/g, (m, text, url) => ['[', text, '][', ctx.addUrl(null, url), ']'].join(''));
	}

	function MEDIA(ctx)
	{
		return ctx.str.replace(/!(!)?\[([^\]]*)\]\[([^\]]+)\]/g, (m, block, txt, urlid) => ctx.push({ type: 'MEDIA', block: block==='!', urlid: urlid, items: ctx.parse(txt), toText: _itemsText }));
	}

	function LINK(ctx)
	{
		return ctx.str.replace(/\[([^\]]+)\]\[([^\]]+)\]/g, (m, txt, urlid) => ctx.push({ type: 'LINK', urlid: urlid, items: ctx.parse(txt) }));
	}

	function MENTION(ctx)
	{
		return ctx.str.replace(/\s@(([a-z0-9_\-\.]+)\/)?([a-z0-9_\-\.]+)/ig, (m, p1, group, id) => ' '+ctx.push({ type: 'MENTION', group: group, id: id }));
	}

	const symbolsConv			= {
		'(c)'					: '©️',
		'(TM)'					: '™️',
		'(R)'					: '®️',
		'...'					: '…',
		'-->'					: '→',
		'<--'					: '←',
		'<-->'					: '↔',
		'<=='					: '⇐',
		'==>'					: '⇒',
		'<==>'					: '⇔',
	};

	function Symbols(ctx)
	{
		return ctx.str.replace(/(\((c|TM|R)\)|\.\.\.|<(--|==)>|<(--|==)|(--|==)>)/g, (m, txt) => symbolsConv[txt]);
	}

	//#endregion

	HR.inline					= false;
	H.inline					= false;
	QUOTE.inline				= false;
	ALERT.inline				= false;
	LIST.inline					= false;
	CODEBLOCK.inline			= false;
	P.inline					= false;

	CODE.inline					= true;
	StandardBR.inline			= true;
	SimpleBR.inline				= true;
	EM.inline					= true;
	DEL.inline					= true;
	MARK.inline					= true;
	SUBSUP.inline				= true;
	EasyLink.inline				= true;
	InlineLink.inline			= true;
	MEDIA.inline				= true;
	LINK.inline					= true;
	MENTION.inline				= true;
	Symbols.inline				= true;

	const allOrdered			= [ HR, H, ALERT, QUOTE, LIST, CODEBLOCK, P, StandardBR, SimpleBR, CODE, Symbols, DEL, MARK, SUBSUP, EasyLink, InlineLink, EM, MEDIA, LINK, MENTION ];
	allOrdered.reduce((order, h) => (h.order=order+100), 0);

	return Object.freeze({
		// Block elements
		HR						: HR,
		H						: H,
		ALERT					: ALERT,
		QUOTE					: QUOTE,
		LIST					: LIST,
		CODEBLOCK				: CODEBLOCK,
		P						: P,
		// Inline elements
		StandardBR				: StandardBR,
		SimpleBR				: SimpleBR,
		CODE					: CODE,
		EM						: EM,
		DEL						: DEL,
		MARK					: MARK,
		SUBSUP					: SUBSUP,
		MEDIA					: MEDIA,
		LINK					: LINK,
		MENTION					: MENTION,
		// Inline transforms
		EasyLink				: EasyLink,
		InlineLink				: InlineLink,
		Symbols					: Symbols,
		// Standard collections
		// All supported
		$ALL					: Object.freeze(allOrdered),
		// Common elements
		$COMMON					: Object.freeze([ HR, H, QUOTE, LIST, CODEBLOCK, P, StandardBR, CODE, DEL, MARK, SUBSUP, EasyLink, InlineLink, EM, MEDIA, LINK ]),
		// All inline elements
		$INLINE					: Object.freeze([ CODE, StandardBR, SimpleBR, DEL, MARK, SUBSUP, EasyLink, InlineLink, EM, MEDIA, LINK, MENTION, Symbols ]),
	});
});