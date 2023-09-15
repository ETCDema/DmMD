/************************************************
 * DmMarkdown 1.0 - Работа с markdown разметкой *
 * Парсер разметки                              *
 ************************************************/
(function (global, factory)
{
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory()
	: typeof define === 'function' && define.amd				 ? define(factory)
	: (global = typeof globalThis !== 'undefined'				 ? globalThis 
	: global || self, (global.DmMD || (global.DmMD = {})).parser = factory());
})(this, function ()
{
	'use strict';

	/**
	 * Элемент DOM.
	 * У элемента должно присутствовать свойство items для элементов - контейнеров.
	 * @typedef MDElement
	 * @prop {string} type						- тип элемента для генерации результата
	 * @prop {(MDElement|string)[]} [items]		- коллекция вложенных элементов
	 * @prop {string} [text]					- текст элемента, если у элемента нет items
	 */

	/**
	 * Блочный элемент DOM
	 * @typedef {MDElement} MDBlockElement
	 * @prop {enterFx} enter					- обработка новой строки созданным ранее элементом
	 * @prop {finFx} fin						- Завершение построения DOM
	 */

	/**
	 * Обработка новой строки созданным ранее элементом
	 * @callback enterFx
	 * @param {blockContext} context			- Контекст работы со строкой
	 * @param {function} addFx					- Добавление нового элемента к контейнеру
	 * @param {function} newFx					- Создание нового блочного элемента
	 * @returns {?MDBlockElement}				- Порожденный элемент из строки или существующий элемент, обработавший строку
	 */

	/**
	 * Завершение построения DOM
	 * @callback finFx
	 * @param {parserFx} parser					- идентификатор ссылки, если не указан будет сгенерирован
	 * @returns {void}
	 */

	/**
	 * Добавление ссылки в коллекцию
	 * @callback addUrlFx
	 * @param {string} [id]						- идентификатор ссылки, если не указан будет сгенерирован
	 * @param {string} data						- ссылка + дополнительно может быть указан размер (23*34 или 23* или *34) и подсказка
	 * @returns {string}						- идентификатор ссылки
	 */

	/**
	 * Контекст работы для блочного элемента
	 * @typedef blockContext
	 * @prop {int} line							- Номер текущей обрабатываемой строки
	 * @prop {string} str						- Текущая обрабатываемая строка
	 * @prop {int} emptyLines					- Счетчик пустых строк
	 * @prop {bool} resetEmptyLines				- =true если после обработки нужно сбросить счетчик пустых строк
	 */

	/**
	 * Добавление элемента в коллекцию с присвоением идентификатора
	 * @callback pushFx
	 * @param {MDElement} el					- добавляемый inline элемент
	 * @returns {string}						- присвоенный идентификатор
	 */

	/**
	 * Создание коллекции inline элементов из текста
	 * @callback parseFx
	 * @param {string} txt						- исходный текст
	 * @returns {(MDElement|string)[]}			- созданная коллекция
	 */

	/**
	 * Контекст работы для inline элемента
	 * @typedef inlineContext
	 * @prop {string} str						- Текущая обрабатываемая строка
	 * @prop {pushFx} push
	 * @prop {parseFx} parse
	 * @prop {addUrlFx} addUrl
	 */
	
	/**
	 * Обработчик блока текста
	 * @callback blockHandlerFx
	 * @param {blockContext} context 			- Контекст работы со строкой
	 * @returns {?MDBlockElement}				- Созданный элемент или null
	 */
	
	/**
	 * Обработчик inline текста
	 * @callback inlineHandlerFx
	 * @param {inlineContext} context 			- Контекст работы с текстом
	 * @returns [string]						- Измененная строка 
	 */
	
	/**
	 * Готовый к использованию парсер текста
	 * @callback parserFx
	 * @param {string} text						- исходный текст
	 * @returns {MDElement}						- Корневой элемент DOM
	 */

	/**
	 * Проверка на пустоту
	 * @param {string} s		- Проверяемая строка
	 * @returns 				- true если строка пустая
	 */
	function _isempty(s) { return s==null || s.length===0; }

	/**
	 * Объект - ссылка
	 * @field {string} id		- Идентификатор ссылки
	 * @field {string} url		- Ссылка абсолютная/относительная
	 * @field {string} [width]	- Ширина при выводе
	 * @field {string} [height]	- Высота при выводе
	 * @field {string} [title]	- Подсказка
	 * @field {number} using	- Количество использований при генерации результата
	 */
	class URL
	{
		constructor(id, data)
		{
			this.id				= id;
			data				= (/\s*(\S*)(\s*(?:(\d+)\*(\d+)?|(?:\*(\d+))))?(?:\s*(?:"([^"]*)"|(\S*)))?/).exec(data);
			this.url			= data[1];
			this.using			= 0;
			this.width			= _isempty(data[3])? null : data[3];
			this.height			= !_isempty(data[5]) ? data[5] : _isempty(data[4])? null : data[4];
			this.title			= _isempty(data[6])? (_isempty(data[7])? null : data[7]) : data[6];
		}

		toString()
		{
			var b=['url="'+this.url+'"'];
			if (this.width)  	b.push('width="'+this.width+'"');
			if (this.height) 	b.push('height="'+this.height+'"');
			if (this.title)     b.push('title="'+this.title+'"');
			return b.join(' ');
		}
	}	

	const textBlockMarker		= Symbol('Temp txt block');
	/**
	 * Служебный контейнер для накопления текста
	 * @param {blockContext} context 
	 * @returns {MDBlockElement}
	 */
	function _text(context)
	{
		if (!context.str) return null;

		const _text				= [ context.str ];
		return {
			[textBlockMarker]	: true,
			enter				: function (ctx, addFx, newFx)
			{ 
				const block		= newFx();
				if (!block[textBlockMarker]) return addFx(block);

				_text.push(ctx.str);
				return this;
			},
			fin					: function (parseFx) { return parseFx(_text.join('\n')); }
		};
	}

	// Подготовка текста к парсингу
	const prepareRE1			= /(\r\n|\r)/g;
	const prepareRE2			= /\t/g;
	const prepareRE3			= /^[ ]+$/gm;
	const prepareRE4			= /\n[ ]*\[([^\]]+)\][ ]?:([^\n]+)/g;
	const prepareRE5			= /([^\n]+)\n([-=])+\n/g;
	/**
	 * Предварительная подготовка текста
	 * @param {string} txt		- Исходный ткст
	 * @param {addUrlFx} addUrl	- Добавление ссылки в коллекцию
	 * @returns {string}		- Готовый для работы текст
	 */
	function _prepare(txt, addUrl)
	{
		return txt
				.replace(prepareRE1, '\n')						// Делаем однотипные переводы строк
				.replace(prepareRE2, '    ')					// Табы заменяем на 4 пробела
				.replace(prepareRE3, '')						// Строки, содержащие только пробелы делаем пустыми
				.replace(prepareRE4, function(m, id, data)		// Ищем все описания ссылок и запоминаем их
				{
					addUrl(id, data);
					return '';
				})
				.replace(prepareRE5, function(m, text, lvl)		// Ищем подчеркнутые заголовки и переформатируем их в обычные
				{
					return (lvl=='='?'# ':'## ')+text+'\n';
				});
	}

	/**
	 * Обработка блочными элементами одной строки
	 * @param {blockContext} context 	- Контекст для обработки строки
	 * @param {string} str 				- Обрабатываемая строка
	 * @param {int} idx 				- Номер строки
	 * @returns blockContext			- переданное в context значение 
	 */
	function _processLine(context, str, idx)
	{
		if (str)
		{
			context.line		= idx;					// Номер строки
			context.str			= str;					// Строка
			context.resetEmptyLines		= true;			// Признак необходимости сброса счетчика пустых строк
			const last			= context.last();		// Последний добавленный на верхний уровень элемент
			last && last.enter && last.enter(context, context.add, context.fx) || context.add(context.fx());
			if (context.resetEmptyLines) context.emptyLines = 0;
		} else
			context.emptyLines++;						// Просто считаем пустые строки
		return context;
	}

	/**
	 * Обработка inline элементов в указанном тексте
	 * @param {string} txt 								- исходный текст
	 * @param {inlineHandlerFx[]} handlers 				- массив inline обработчиков
	 * @param {pushFx} pushFx 							- функция сохранения элемента
	 * @param {parseFx} parseFx 						- функция обработки текста
	 * @param {Object.<string,MDElements>} inlineEls 	- коллекция сохраненных элементов
	 * @param {addUrlFx} addUrl 						- функция добавления ссылки
	 * @returns (MDElements|string)[]					- коллекция элементов из исходного текста
	 */
	function _processInline(txt, handlers, pushFx, parseFx, inlineEls, addUrl)
	{
		// Пропустим через все обработчики
		txt						= handlers.reduce((ctx, h) => ((ctx.str = h(ctx)) && false || ctx), { str: txt, push: pushFx, parse: parseFx, addUrl: addUrl}).str;
		if (!txt) return [];

		// Нарежем результат на строки и элементы
		const items				= [];
		const re				= /\0\d+\0/g;			// Будем искать идентификаторы элементов
		let last				= 0;					// Позиция в строке с которой продолжаем обработку
		let m;
		while(m = re.exec(txt))
		{
			if (last<m.index) items.push(txt.substring(last, m.index));
			items.push(inlineEls[m[0]]);
			last				= re.lastIndex;
		}
		if (last<txt.length) items.push(txt.substring(last));
		return items;
	}

	/**
	 * Завершение обработки
	 * @param {MDElement[]} items 		- массив готовых элементов
	 * @param {parseFx} parseFx 		- функция генерации элементов на основе текста
	 * @returns {void}
	 */
	function _fin(items, parseFx)
	{
		for (let i=0; i<items.length; i++)
		{
			const item			= items[i];
			if (item[textBlockMarker])	// У нас спецконтейнер для текста
			{
				const add		= item.fin(parseFx);	// Получим элементы из текста
				items.splice(i, 1, ...add);				// Заменим контейнер новыми элементами
				continue;								// Все, забыли по этот элемент
			}

			if (item.fin)		item.fin(parseFx);
			else if (item.items)_fin(item.items, parseFx);
			// Убираем служебные методы
			delete item.fin;
			delete item.enter;
		}
	}

	/**
	 * Создание парсера
	 * @param {(blockHandlerFx|inlineHandlerFx)[]} useHandlers - обработчики текста
	 * @returns {parserFx}
	 */
	function parserBuilder(useHandlers)
	{
		const nul				= String.fromCharCode(0);
		// Готовим элементы к работе: отделяем блочные от inline, сортируем в нужном порядке
		const handlers			= { block: [], inline: [] };
		useHandlers && useHandlers.filter((h) => !!h)
								  .sort  ((h1, h2) => (h1.order-h2.order))
								  .reduce((r, h) => (h.inline===true ? handlers.inline.push(h) : handlers.block.push(h)), null);

		const _inlineBuilder	= handlers.inline.length>0
								? function(addUrl)
								{
									const inlineEls		= {};
									let inlineID		= 0;
									const pushFx		= (el) => 
									{
										const id		= nul+(inlineID++)+nul;
										inlineEls[id]	= el;
										return id;
									};
									const inlineFx		= (txt) => _processInline(txt, handlers.inline, pushFx, inlineFx, inlineEls, addUrl);
									return inlineFx;
								}
								: function() { return (txt) => (txt && [ txt ] || []); };
		
		const _parse			= handlers.block.length>0
								? function(txt, addUrl, inlineFx)
								{
									const items			= [];			// Элементы уровня документа
									// Контекст обработки
									const context		= {
										line			: null,			// Номер текущей обрабатываемой строки
										str				: null,			// Текущая обрабатываемая строка
										emptyLines		: 0,			// Счетчик пустых строк
										last			: () => items[items.length-1],
										add				: (el) => (el && items.push(el) || el),
									};
									context.fx			= () => (handlers.block.reduce((b, h) => (b || h(context)), null) || _text(context));
									_prepare(txt, addUrl).split('\n').reduce(_processLine, context);
									_fin(items, inlineFx);
									return items;
								}
								: function(txt, addUrl, inlineFx) { return inlineFx(_prepare(txt, addUrl)); }

		console.log('Markdown parser created with handlers:', handlers);

		return function(txt)
		{
			const start			= performance.now();

			const urls			= {};							// Коллекция найденных ссылок
			let urlID			= 0;
			const addUrl		= (id, data) =>
			{
				if (!id) id 	= '#'+(urlID++);
				urls[id]		= new URL(id, data);
				return id;
			};

			const inlineFx		= _inlineBuilder(addUrl);		// Парсер inline элементов
			const items			= _parse(txt, addUrl, inlineFx);// Элементы уровня документа

			return { type: 'ROOT', items: items, urls: urls, srcLen: txt.length, parseTime: (performance.now()-start)+'ms' };
		};
	}

	return parserBuilder;
});