/*
	This file is part of myTinyTodo.
	(C) Copyright 2009-2010 Max Pozdeev <maxpozdeev@gmail.com>
	Licensed under the GNU GPL v3 license. See file COPYRIGHT for details.
*/

(function(){

var taskList = new Array(), taskOrder = new Array();
var filter = { compl:0, search:'', due:'' };
var sortOrder; //save task order before dragging
var searchTimer;
var objPrio = {};
var selTask = 0;
var flag = { needAuth:false, isLogged:false, tagsChanged:true, readOnly:false, editFormChanged:false };
var taskCnt = { total:0, past: 0, today:0, soon:0 };
var tabLists = {
	_lists: {},
	_length: 0,
	_order: [],
	_alltasks: {},
	clear: function(){
		this._lists = {}; this._length = 0; this._order = [];
		this._alltasks = { id:-1, showCompl:0, sort:3 }; 
	},
	length: function(){ return this._length; },
	exists: function(id){ if(this._lists[id] || id==-1) return true; else return false; },
	add: function(list){ this._lists[list.id] = list; this._length++; this._order.push(list.id); },
	replace: function(list){ this._lists[list.id] = list; },
	get: function(id){ if(id==-1) return this._alltasks; else return this._lists[id]; },
	getAll: function(){ var r = []; for(var i in this._order) { r.push(this._lists[this._order[i]]); }; return r; },
	reorder: function(order){ this._order = order; }
};
var curList = 0;
var tagsList = [];

var mytinytodo = window.mytinytodo = _mtt = {

	theme: {
		newTaskFlashColor: '#ffffaa',
		editTaskFlashColor: '#bbffaa',
		msgFlashColor: '#ffffff'
	},

	actions: {},
	menus: {},
	mttUrl: '',
	templateUrl: '',
	options: {
		openList: 0,
		singletab: false,
		autotag: false,
		tagPreview: true,
		tagPreviewDelay: 700, //milliseconds
		saveShowNotes: false,
		firstdayofweek: 1,
		touchDevice: false
	},

	timers: {
		previewtag: 0
	},

	lang: {
		__lang: null,

		daysMin: [],
		daysLong: [],
		monthsShort: [],
		monthsLong: [],

		get: function(v) {
			if(this.__lang[v]) return this.__lang[v];
			else return v;
		},
		
		init: function(lang)
		{
			this.__lang = lang;
			this.daysMin = this.__lang.daysMin;
			this.daysLong = this.__lang.daysLong;
			this.monthsShort = this.__lang.monthsMin;
			this.monthsLong = this.__lang.monthsLong;
		}
	},

	pages: { 
		current: { page:'tasks', pageClass:'' },
		prev: []
	},

	// procs
	init: function(options)
	{
		jQuery.extend(this.options, options);

		flag.needAuth = options.needAuth ? true : false;
		flag.isLogged = options.isLogged ? true : false;

		if(this.options.showdate) $('#page_tasks').addClass('show-inline-date');
		if(this.options.singletab) $('#lists .mtt-tabs').addClass('mtt-tabs-only-one');

		this.parseAnchor();

		// handlers
		$('.mtt-tabs-add-button').click(function(){
			addList();
		});

		$('.mtt-tabs-select-button').click(function(event){
			if(event.metaKey || event.ctrlKey) {
				// toggle singetab interface
				_mtt.applySingletab(!_mtt.options.singletab);
				return false;
			}
			if(!_mtt.menus.selectlist) _mtt.menus.selectlist = new mttMenu('slmenucontainer', {onclick:slmenuSelect});
			_mtt.menus.selectlist.show(this);
		});


		$('#newtask_form').submit(function(){
			submitNewTask(this);
			return false;
		});
		
		$('#newtask_submit').click(function(){
			$('#newtask_form').submit();
		});

		$('#newtask_adv').click(function(){
			showEditForm(1);
			return false;
		});
		
		$('#task').keydown(function(event){
			if(event.keyCode == 27) {
				$(this).val('');
			}
		}).focusin(function(){
			$('#task_placeholder').removeClass('placeholding');
			$('#toolbar').addClass('mtt-intask');
		}).focusout(function(){
			if('' == $(this).val()) $('#task_placeholder').addClass('placeholding');
			$('#toolbar').removeClass('mtt-intask');
		});


		$('#search_form').submit(function(){
			searchTasks(1);
			return false;
		});

		$('#search_close').click(function(){
			liveSearchToggle(0);
			return false;
		});

		$('#search').keyup(function(event){
			if(event.keyCode == 27) return;
			if($(this).val() == '') $('#search_close').hide();	//actual value is only on keyup
			else $('#search_close').show();
			clearTimeout(searchTimer);
			searchTimer = setTimeout(function(){searchTasks()}, 400);
		})
		.keydown(function(event){
			if(event.keyCode == 27) { // cancel on Esc (NB: no esc event on keypress in Chrome and on keyup in Opera)
				if($(this).val() != '') {
					$(this).val('');
					$('#search_close').hide();
					searchTasks();
				}
				else {
					liveSearchToggle(0);
				}
				return false; //need to return false in firefox (for AJAX?)
			}		
		}).focusin(function(){
			$('#toolbar').addClass('mtt-insearch');
			$(this).focus();
		}).focusout(function(){
			$('#toolbar').removeClass('mtt-insearch');
		});


		$('#taskview').click(function(){
			if(!_mtt.menus.taskview) _mtt.menus.taskview = new mttMenu('taskviewcontainer');
			_mtt.menus.taskview.show(this);
		});

		$(document).on('click', '#mtt_filters .tag-filter .mtt-filter-close', function(){
			cancelTagFilter($(this).attr('tagid'));
		});

		$('#tagcloudbtn').click(function(){
			if(!_mtt.menus.tagcloud) _mtt.menus.tagcloud = new mttMenu('tagcloud', {
				beforeShow: function(){
					if(flag.tagsChanged) {
						$('#tagcloudcontent').html('');
						$('#tagcloudload').show();
						loadTags(curList.id, function(){$('#tagcloudload').hide();});
					}
				}, adjustWidth:true
			});
			_mtt.menus.tagcloud.show(this);
		});

		$('#tagcloudcancel').click(function(){
			if(_mtt.menus.tagcloud) _mtt.menus.tagcloud.close();
		});

		$(document).on('click', '#tagcloudcontent .tag', function(){
			addFilterTag($(this).attr('tag'), $(this).attr('tagid'));
			if(_mtt.menus.tagcloud) _mtt.menus.tagcloud.close();
			return false;
		});	

		$('#mtt-notes-show').click(function(){
			toggleAllNotes(1);
			this.blur();
			return false;
		});

		$('#mtt-notes-hide').click(function(){
			toggleAllNotes(0);
			this.blur();
			return false;
		});

		$('#taskviewcontainer li').click(function(){
			if(this.id == 'view_tasks') setTaskview(0);
			else if(this.id == 'view_past') setTaskview('past');
			else if(this.id == 'view_today') setTaskview('today');
			else if(this.id == 'view_soon') setTaskview('soon');
		});

		
		// Tabs
		$(document).on('click', '#lists li', function(event){
			if(event.metaKey || event.ctrlKey) {
				// hide the tab
				hideTab(this);
				return false;
			}
			tabSelect(this);
            $('#mypanel').panel('close');
			return false;
		});
		
		$('#list_all').click(function(event){
			if(event.metaKey || event.ctrlKey) {
				// hide the tab
				hideTab(-1);
				return false;
			}
			tabSelect(-1);
			return false;
		});

		$(document).on('click', '#lists li.mtt-tab .list-action', function(){
			listMenu(this);
			return false;	//stop bubble to tab click
		});
		
		$('#list_all .list-action').click(function(event){
			listMenu(this);
			return false;	//stop bubble to tab click
		});

		//Priority popup
		$('#priopopup .prio-neg-1').click(function(){
			prioClick(-1,this);
		});

		$('#priopopup .prio-zero').click(function(){
			prioClick(0,this);
		});

		$('#priopopup .prio-pos-1').click(function(){
			prioClick(1,this);
		});

		$('#priopopup .prio-pos-2').click(function(){
			prioClick(2,this);
		});

		$('#priopopup').mouseleave(function(){
			$(this).hide()}
		);


		// edit form handlers
		$('#alltags_show').click(function(){
			toggleEditAllTags(1);
			return false;
		});

		$('#alltags_hide').click(function(){
			toggleEditAllTags(0);
			return false;
		});

		$('#taskedit_form').submit(function(){
			return saveTask(this);
		});

		$(document).on('click', '#alltags .tag', function(){
			addEditTag($(this).attr('tag'));
			return false;
		});
		
		//$("#duedate").datepicker({
			//dateFormat: _mtt.duedatepickerformat(),
			//firstDay: _mtt.options.firstdayofweek,
			//showOn: 'button',
			//buttonImage: _mtt.templateUrl + 'images/calendar.png', buttonImageOnly: true,
			//constrainInput: false,
			//duration:'',
			//dayNamesMin:_mtt.lang.daysMin, dayNames:_mtt.lang.daysLong, monthNamesShort:_mtt.lang.monthsLong
		//});

		$("#edittags").autocomplete('ajax.php?suggestTags', {scroll: false, multiple: true, selectFirst:false, max:8, extraParams:{list:function(){ var taskId = document.getElementById('taskedit_form').id.value; return taskList[taskId].listId; }}});

		$('#taskedit_form').find('select,input,textarea').bind('change keypress', function(){
			flag.editFormChanged = true;
		});

		// tasklist handlers
		$("#tasklist").bind("click", tasklistClick);
		
		$(document).on('dblclick', '#tasklist li', function(){
			//clear selection
			if(document.selection && document.selection.empty && document.selection.createRange().text) document.selection.empty();
			else if(window.getSelection) window.getSelection().removeAllRanges();
			
			var li = findParentNode(this, 'LI');
			if(li && li.id) {
				var id = li.id.split('_',2)[1];
				if(id) editTask(parseInt(id));
			}
		});

		$(document).on('click', '#tasklist .taskactionbtn', function(){
			var id = parseInt(getLiTaskId(this));
			if(id) taskContextMenu(this, id);
			return false;
		});

		$(document).on('click', '#tasklist input[type=checkbox]', function(){
			var id = parseInt(getLiTaskId(this));
			if(id) completeTask(id, this);
			//return false;
		});

		$(document).on('click', '#tasklist .task-toggle', function(){
			var id = getLiTaskId(this);
			if(id) $('#taskrow_'+id).toggleClass('task-expanded');
			return false;
		});

		$(document).on('click', '#tasklist .tag', function(event){
			clearTimeout(_mtt.timers.previewtag);
			$('#tasklist li').removeClass('not-in-tagpreview');
			addFilterTag($(this).attr('tag'), $(this).attr('tagid'), (event.metaKey || event.ctrlKey ? true : false) );
			return false;
		});

		if(!this.options.touchDevice) {
			$(document).on('mouseover mouseout', '#tasklist .task-prio', function(event){
				var id = parseInt(getLiTaskId(this));
				if(!id) return;
				if(event.type == 'mouseover') prioPopup(1, this, id);
				else prioPopup(0, this);
			});
		}

		$(document).on('click', '#tasklist .mtt-action-note-cancel', function(){
			var id = parseInt(getLiTaskId(this));
			if(id) cancelTaskNote(id);
			return false;
		});

		$(document).on('click', '#tasklist .mtt-action-note-save', function(){
			var id = parseInt(getLiTaskId(this));
			if(id) saveTaskNote(id);
			return false;
		});

		if(this.options.tagPreview) {
			$(document).on('mouseover mouseout', '#tasklist .tag', function(event){
				var cl = 'tag-id-' + $(this).attr('tagid');
				var sel = (event.metaKey || event.ctrlKey) ? 'li.'+cl : 'li:not(.'+cl+')';
				if(event.type == 'mouseover') {
					_mtt.timers.previewtag = setTimeout( function(){$('#tasklist '+sel).addClass('not-in-tagpreview');}, _mtt.options.tagPreviewDelay);
				}
				else {
					clearTimeout(_mtt.timers.previewtag);
					$('#tasklist li').removeClass('not-in-tagpreview');
				}
			});
		}

		//$("#tasklist").sortable({
				//items:'> :not(.task-completed)', cancel:'span,input,a,textarea',
				 //delay:150, start:sortStart, update:orderChanged, 
				//placeholder:'mtt-task-placeholder'
		//});

		//$("#lists ul").sortable({delay:150, update:listOrderChanged}); 
		//this.applySingletab();


		// AJAX Errors
		$('#msg').ajaxSend(function(r,s){
			$("#msg").hide().removeClass('mtt-error mtt-info').find('.msg-details').hide();
			$("#loading").show();
		});

		$('#msg').ajaxStop(function(r,s){
			$("#loading").fadeOut();
		});

		$('#msg').ajaxError(function(event, request, settings){
			var errtxt;
			if(request.status == 0) errtxt = 'Bad connection';
			else if(request.status != 200) errtxt = 'HTTP: '+request.status+'/'+request.statusText;
			else errtxt = request.responseText;
			flashError(_mtt.lang.get('error'), errtxt); 
		}); 


		// Error Message details
		$("#msg>.msg-text").click(function(){
			$("#msg>.msg-details").toggle();
		});


		// Authorization
		$('#bar_login').click(function(){
			showAuth(this);
			return false;
		});

		$('#bar_logout').click(function(){
			logout();
			return false;
		});

		$('#login_form').submit(function(){
			doAuth(this);
			return false;
		});


		// Settings
		$("#settings").click(showSettings);
		$(document).on('submit', "#settings_form", function() {
			saveSettings(this);
			return false;
		});
		
		$(document).on('click', ".mtt-back-button", function(){ _mtt.pageBack(); this.blur(); return false; } );

		$(window).bind('beforeunload', function() {
			if(_mtt.pages.current.page == 'taskedit' && flag.editFormChanged) {
				return _mtt.lang.get('confirmLeave');
			}
		});

        $(document).on('click', '#page_tasks #header_btn_task_lists', function(){
            handleTaskListsButtonClicked();
        });

        $(document).on('click', '#page_tasks #header_btn_add_task', function(){
            showEditForm(1);
        });

        $(document).on('click', '#page_taskedit #header_btn_edit_task_save', function(){
            handleSaveTaskButtonClicked();
        });

        $(document).on('click', '#page_taskedit #header_btn_edit_task_back', function(){
            _mtt.pageBack();
        });

        $(document).on('click', '#settings_bar_logout', function(){
            logout();
        });

		// tab menu
		this.addAction('listSelected', tabmenuOnListSelected);

		// task context menu
		this.addAction('listsLoaded', cmenuOnListsLoaded);
		this.addAction('listRenamed', cmenuOnListRenamed);
		this.addAction('listAdded', cmenuOnListAdded);
		this.addAction('listSelected', cmenuOnListSelected);
		this.addAction('listOrderChanged', cmenuOnListOrderChanged);
		this.addAction('listHidden', cmenuOnListHidden);

		// select list menu
		this.addAction('listsLoaded', slmenuOnListsLoaded);
		this.addAction('listRenamed', slmenuOnListRenamed);
		this.addAction('listAdded', slmenuOnListAdded);
		this.addAction('listSelected', slmenuOnListSelected);
		this.addAction('listHidden', slmenuOnListHidden);

		return this;
	},

	log: function(v)
	{
		console.log.apply(this, arguments);
	},

	addAction: function(action, proc)
	{
		if(!this.actions[action]) this.actions[action] = new Array();
		this.actions[action].push(proc);
	},

	doAction: function(action, opts)
	{
		if(!this.actions[action]) return;
		for(var i in this.actions[action]) {
			this.actions[action][i](opts);
		}
	},

	setOptions: function(opts) {
		jQuery.extend(this.options, opts);
	},

	loadLists: function(onInit)
	{
		if(filter.search != '') {
			filter.search = '';
			$('#searchbarkeyword').text('');
			$('#searchbar').hide();
		}
		$('#page_tasks').hide();
		$('#tasklist').html('');
		
		tabLists.clear();
		
		this.db.loadLists(null, function(res)
		{
			var ti = '';
			var openListId = 0;
			if(res && res.total)
			{
				// open required or first non-hidden list
				for(var i=0; i<res.list.length; i++) {
					if(_mtt.options.openList) {
						if(_mtt.options.openList == res.list[i].id) {
							openListId = res.list[i].id;
							break;
						}
					}
					else if(!res.list[i].hidden) {
						openListId = res.list[i].id;
						break;
					}
				}
				
				// open all tasks tab
				if(_mtt.options.openList == -1) openListId = -1;
				
				// or open first if all list are hidden
				if(!openListId) openListId = res.list[0].id;
				
				$.each(res.list, function(i,item){
					tabLists.add(item);
					ti += '<li id="list_'+item.id+'">'+
						'<a href="#list/'+item.id+'" title="'+item.name+'">'+item.name+
						'</a></li>';
				});
			}
			
			//if(openListId) {
				//$('#mtt_body').removeClass('no-lists');
				//$('.mtt-need-list').removeClass('mtt-item-disabled');
			//}
			//else {
				//curList = 0;
				//$('#mtt_body').addClass('no-lists');
				//$('.mtt-need-list').addClass('mtt-item-disabled');
			//}

			_mtt.options.openList = 0;
			$('#lists ul').html(ti);
			$('#lists').show();
			$('#lists ul').listview("refresh");
			_mtt.doAction('listsLoaded');
			tabSelect(openListId);

			$('#page_tasks').show();

		});

		if(onInit) {
            $("#mypanel").trigger("updatelayout");
            updateAccessStatus();
        }
	},

	duedatepickerformat: function()
	{
		if(!this.options.duedatepickerformat) return 'yy-mm-dd';
	
		var s = this.options.duedatepickerformat.replace(/(.)/g, function(t,s) {
			switch(t) {
				case 'Y': return 'yy';
				case 'y': return 'y';
				case 'd': return 'dd';
				case 'j': return 'd';
				case 'm': return 'mm';
				case 'n': return 'm';
				case '/':
				case '.':
				case '-': return t;
				default: return '';
			}
		});

		if(s == '') return 'yy-mm-dd';
		return s;
	},

	errorDenied: function()
	{
		flashError(this.lang.get('denied'));
	},
	
	pageSet: function(page, pageClass)
	{
		var prev = this.pages.current;
		prev.lastScrollTop = $(window).scrollTop();
		this.pages.prev.push(this.pages.current);
		this.pages.current = {page:page, pageClass:pageClass};
		showhide($('#page_'+ this.pages.current.page).addClass('mtt-page-'+ this.pages.current.pageClass), $('#page_'+ prev.page));
	},
	
	pageBack: function()
	{
		if(this.pages.current.page == 'tasks') return false;
		var prev = this.pages.current;
		this.pages.current = this.pages.prev.pop();
		showhide($('#page_'+ this.pages.current.page), $('#page_'+ prev.page).removeClass('mtt-page-'+prev.page.pageClass));
		$(window).scrollTop(this.pages.current.lastScrollTop);
	},
	
	applySingletab: function(yesno)
	{
		if(yesno == null) yesno = this.options.singletab;
		else this.options.singletab = yesno;
		
		if(yesno) {
			$('#lists .mtt-tabs').addClass('mtt-tabs-only-one');
			//$("#lists ul").sortable('disable');
		}
		else {
			$('#lists .mtt-tabs').removeClass('mtt-tabs-only-one');
			//$("#lists ul").sortable('enable');
		}
	},
	
	filter: {
		_filters: [],
		clear: function() {
			this._filters = [];
			$('#mtt_filters').html('');
		},
		addTag: function(tagId, tag, exclude)
		{
			for(var i in this._filters) {
				if(this._filters[i].tagId && this._filters[i].tagId == tagId) return false;
			}
			this._filters.push({tagId:tagId, tag:tag, exclude:exclude});
			$('#mtt_filters').append('<span class="tag-filter tag-id-'+tagId+
				(exclude ? ' tag-filter-exclude' : '')+'"><span class="mtt-filter-header">'+
				_mtt.lang.get('tagfilter')+'</span>'+tag+'<span class="mtt-filter-close" tagid="'+tagId+'"></span></span>');
			return true;
		},
		cancelTag: function(tagId)
		{
			for(var i in this._filters) {
				if(this._filters[i].tagId && this._filters[i].tagId == tagId) {
					this._filters.splice(i,1);
					$('#mtt_filters .tag-filter.tag-id-'+tagId).remove();
					return true;
				}
			}
			return false;
		},
		getTags: function(withExcluded)
		{
			var a = [];
			for(var i in this._filters) {
				if(this._filters[i].tagId) {
					if(this._filters[i].exclude && withExcluded) a.push('^'+ this._filters[i].tag);
					else if(!this._filters[i].exclude) a.push(this._filters[i].tag)
				}
			}
			return a.join(', ');
		}
	},
	
	parseAnchor: function()
	{
		if(location.hash == '') return false;
		var h = location.hash.substr(1);
		var a = h.split("/");
		var p = {};
		var s = '';
		
		for(var i=0; i<a.length; i++)
		{
			s = a[i];
			switch(s) {
				case "list": if(a[++i].match(/^-?\d+$/)) { p[s] = a[i]; } break;
				case "alltasks": p.list = '-1'; break;
			}
		}

		if(p.list) this.options.openList = p.list;
		
		return p;
	}

};

function addList()
{
	var r = prompt(_mtt.lang.get('addList'), _mtt.lang.get('addListDefault'));
	if(r == null) return;

	_mtt.db.request('addList', {name:r}, function(json){
		if(!parseInt(json.total)) return;
		var item = json.list[0];
		var i = tabLists.length();
		tabLists.add(item);
		if(i > 0) {
			$('#lists ul').append('<li id="list_'+item.id+'" class="mtt-tab">'+
					'<a href="#" title="'+item.name+'"><span>'+item.name+'</span>'+
					'<div class="list-action"></div></a></li>');
			mytinytodo.doAction('listAdded', item);
		}
		else _mtt.loadLists();
	});
};

function renameCurList()
{
	if(!curList) return;
	var r = prompt(_mtt.lang.get('renameList'), dehtml(curList.name));
	if(r == null || r == '') return;

	_mtt.db.request('renameList', {list:curList.id, name:r}, function(json){
		if(!parseInt(json.total)) return;
		var item = json.list[0];
		curList = item;
		tabLists.replace(item); 
		$('#lists ul>.mtt-tabs-selected>a').attr('title', item.name).find('span').html(item.name);
		mytinytodo.doAction('listRenamed', item);
	});
};

function deleteCurList()
{
	if(!curList) return false;
	var r = confirm(_mtt.lang.get('deleteList'));
	if(!r) return;

	_mtt.db.request('deleteList', {list:curList.id}, function(json){
		if(!parseInt(json.total)) return;
		_mtt.loadLists();
	})
};

function publishCurList()
{
	if(!curList) return false;
	_mtt.db.request('publishList', { list:curList.id, publish:curList.published?0:1 }, function(json){
		if(!parseInt(json.total)) return;
		curList.published = curList.published?0:1;
		if(curList.published) {
			$('#btnPublish').addClass('mtt-item-checked');
			$('#btnRssFeed').removeClass('mtt-item-disabled');
		}
		else {
			$('#btnPublish').removeClass('mtt-item-checked');
			$('#btnRssFeed').addClass('mtt-item-disabled');
		}
	});
};


function loadTasks(opts)
{
	if(!curList) return false;
	setSort(curList.sort, 1);
	opts = opts || {};
	if(opts.clearTasklist) {
		$('#tasklist').html('');
		$('#total').html('0');
        if (curList.id >= 0 && tabLists.get(curList.id)) {
            $('#header_title_tasks').html(tabLists.get(curList.id).name);
        }
	}

	_mtt.db.request('loadTasks', {
		list: curList.id,
		compl: curList.showCompl,
		sort: curList.sort,
		search: filter.search,
		tag: _mtt.filter.getTags(true),
		setCompl: opts.setCompl
	}, function(json){
		taskList.length = 0;
		taskOrder.length = 0;
		taskCnt.total = taskCnt.past = taskCnt.today = taskCnt.soon = 0;
		var tasks = '';
		var listName = '';
		$.each(json.list, function(i,item){
			tasks += prepareTaskStr(item);
			taskList[item.id] = item;
			taskOrder.push(parseInt(item.id));
			changeTaskCnt(item, 1);
            listName = tabLists.get(item.listId).name;
		});
		if(opts.beforeShow && opts.beforeShow.call) {
			opts.beforeShow();
		}
		refreshTaskCnt();
		$('#tasklist').html(tasks);
		$('#tasklist').collapsibleset("refresh");
		$('#header_title').text(listName);

        $('[id^=taskrow_]').on('expand', function(event,ui){
            console.log("show menu on expand, id=" + this.id);
            taskContextMenu(this, this.id.split('_',2)[1]);
        });
	});
};


function prepareTaskStr(item, noteExp)
{
	// &mdash; = &#8212; = —
	var id = item.id;
	var prio = item.prio;
    return '<div id="taskrow_'+id+'" data-role="collapsible">' +
               '<h3>' + preparePrio(item.prio, item.id) + prepareHtml(item.title) + '</h3>' +
               '<p>' +
                   '<div class="task-notes">' + prepareHtml(item.note) + '</div>' +
                   '<div class="' + ((!item.duedate || item.compl)?'task-due-date-completed ':'task-due-date '+'task-due-date-'+item.dueClass) +'">' + prepareDuedate(item) + '</div>' +
                   '<div>' + prepareTagsStr(item) + '</div>'+
                   '<div class="task-date">' + item.dateInlineTitle + '</div>'+
                   (item.compl?'<div class="task-date-completed">' + item.dateCompletedInline + '</div>' : '') +
                   '<div id="taskcontextcontainer_'+id+'" class="task-menu" align="right">'+
                   '<ul>' +
                   '<li id="cmenu_task_complete:'+id+'"><a id="cmenu_task_complete_'+id+'" href="#" data-role="button" data-icon="delete" data-iconpos="notext" data-theme="c" data-inline="true">Complete</a></li>'+
                   '<li id="cmenu_task_move:'+id+'"><a id="cmenu_task_move_'+id+'" href="#" data-role="button" data-icon="add" data-iconpos="notext" data-theme="c" data-inline="true">Move</a></li>'+
                   '<li id="cmenu_edit:'+id+'"><a id="cmenu_edit_'+id+'" href="#" data-role="button" data-icon="edit" data-iconpos="notext" data-theme="c" data-inline="true">Edit</a></li>'+
                   '</ul>' +
                   '</div>' +
               '</p>' +
           '</div>\n';
};


function prepareHtml(s)
{
	// make URLs clickable
	s = s.replace(/(^|\s|>)(www\.([\w\#$%&~\/.\-\+;:=,\?\[\]@]+?))(,|\.|:|)?(?=\s|&quot;|&lt;|&gt;|\"|<|>|$)/gi, '$1<a href="http://$2" target="_blank">$2</a>$4');
	return s.replace(/(^|\s|>)((?:http|https|ftp):\/\/([\w\#$%&~\/.\-\+;:=,\?\[\]@]+?))(,|\.|:|)?(?=\s|&quot;|&lt;|&gt;|\"|<|>|$)/ig, '$1<a href="$2" target="_blank">$2</a>$4');
};

function preparePrio(prio,id)
{
	var cl =''; var v = '';
	if(prio < 0) { cl = 'prio-neg prio-neg-'+Math.abs(prio); v = '&#8722;'+Math.abs(prio); }	// &#8722; = &minus; = −
	else if(prio > 0) { cl = 'prio-pos prio-pos-'+prio; v = '+'+prio; }
	else { cl = 'prio-zero'; v = '&#177;0'; }													// &#177; = &plusmn; = ±
	return '<span class="task-prio '+cl+'">'+v+'</span>';
};

function prepareTagsStr(item)
{
	if(!item.tags || item.tags == '') return '';
	var a = item.tags.split(',');
	if(!a.length) return '';
	var b = item.tags_ids.split(',')
	for(var i in a) {
		a[i] = '<a href="#" class="tag" tag="'+a[i]+'" tagid="'+b[i]+'">'+a[i]+'</a>';
	}
	return '<span class="task-tags">'+a.join(', ')+'</span>';
};

function prepareTagsClass(ids)
{
	if(!ids || ids == '') return '';
	var a = ids.split(',');
	if(!a.length) return '';
	for(var i in a) {
		a[i] = 'tag-id-'+a[i];
	}
	return ' '+a.join(' ');
};

function prepareDuedate(item)
{
	if(!item.duedate) return '';
	return '<span class="duedate" title="'+item.dueTitle+'"><span class="duedate-arrow">→</span> '+item.dueStr+'</span>';
};


function submitNewTask(form)
{
	if(form.task.value == '') return false;
	_mtt.db.request('newTask', { list:curList.id, title: form.task.value, tag:_mtt.filter.getTags() }, function(json){
		if(!json.total) return;
		$('#total').text( parseInt($('#total').text()) + 1 );
		taskCnt.total++;
		form.task.value = '';
		var item = json.list[0];
		taskList[item.id] = item;
		taskOrder.push(parseInt(item.id));
		$('#tasklist').append(prepareTaskStr(item));
		$('#tasklist').collapsibleset("refresh");
		changeTaskOrder(item.id);
		$('#taskrow_'+item.id).effect("highlight", {color:_mtt.theme.newTaskFlashColor}, 2000);
		refreshTaskCnt();
        $('#taskrow_'+item.id).on('expand', function(event,ui){
            console.log("show menu on expand, id=" + this.id);
            taskContextMenu(this, this.id.split('_',2)[1]);
        });
	}); 
	flag.tagsChanged = true;
	return false;
};


function changeTaskOrder(id)
{
	id = parseInt(id);
	if(taskOrder.length < 2) return;
	var oldOrder = taskOrder.slice();
	// sortByHand
	if(curList.sort == 0) taskOrder.sort( function(a,b){ 
			if(taskList[a].compl != taskList[b].compl) return taskList[a].compl-taskList[b].compl;
			return taskList[a].ow-taskList[b].ow
		});
	// sortByPrio
	else if(curList.sort == 1) taskOrder.sort( function(a,b){
			if(taskList[a].compl != taskList[b].compl) return taskList[a].compl-taskList[b].compl;
			if(taskList[a].prio != taskList[b].prio) return taskList[b].prio-taskList[a].prio;
			if(taskList[a].dueInt != taskList[b].dueInt) return taskList[a].dueInt-taskList[b].dueInt;
			return taskList[a].ow-taskList[b].ow; 
		});
	// sortByPrio (reverse)
	else if(curList.sort == 101) taskOrder.sort( function(a,b){
			if(taskList[a].compl != taskList[b].compl) return taskList[a].compl-taskList[b].compl;
			if(taskList[a].prio != taskList[b].prio) return taskList[a].prio-taskList[b].prio;
			if(taskList[a].dueInt != taskList[b].dueInt) return taskList[b].dueInt-taskList[a].dueInt;
			return taskList[b].ow-taskList[a].ow; 
		});		
	// sortByDueDate
	else if(curList.sort == 2) taskOrder.sort( function(a,b){
			if(taskList[a].compl != taskList[b].compl) return taskList[a].compl-taskList[b].compl;
			if(taskList[a].dueInt != taskList[b].dueInt) return taskList[a].dueInt-taskList[b].dueInt;
			if(taskList[a].prio != taskList[b].prio) return taskList[b].prio-taskList[a].prio;
			return taskList[a].ow-taskList[b].ow; 
		});
	// sortByDueDate (reverse)
	else if(curList.sort == 102) taskOrder.sort( function(a,b){
			if(taskList[a].compl != taskList[b].compl) return taskList[a].compl-taskList[b].compl;
			if(taskList[a].dueInt != taskList[b].dueInt) return taskList[b].dueInt-taskList[a].dueInt;
			if(taskList[a].prio != taskList[b].prio) return taskList[a].prio-taskList[b].prio;
			return taskList[b].ow-taskList[a].ow; 
		});		
	// sortByDateCreated
	else if(curList.sort == 3) taskOrder.sort( function(a,b){
			if(taskList[a].compl != taskList[b].compl) return taskList[a].compl-taskList[b].compl;
			if(taskList[a].dateInt != taskList[b].dateInt) return taskList[a].dateInt-taskList[b].dateInt;
			if(taskList[a].prio != taskList[b].prio) return taskList[b].prio-taskList[a].prio;
			return taskList[a].ow-taskList[b].ow; 
		});
	// sortByDateCreated (reverse)
	else if(curList.sort == 103) taskOrder.sort( function(a,b){
			if(taskList[a].compl != taskList[b].compl) return taskList[a].compl-taskList[b].compl;
			if(taskList[a].dateInt != taskList[b].dateInt) return taskList[b].dateInt-taskList[a].dateInt;
			if(taskList[a].prio != taskList[b].prio) return taskList[a].prio-taskList[b].prio;
			return taskList[b].ow-taskList[a].ow; 
		});
	// sortByDateModified
	else if(curList.sort == 4) taskOrder.sort( function(a,b){
			if(taskList[a].compl != taskList[b].compl) return taskList[a].compl-taskList[b].compl;
			if(taskList[a].dateEditedInt != taskList[b].dateEditedInt) return taskList[a].dateEditedInt-taskList[b].dateEditedInt;
			if(taskList[a].prio != taskList[b].prio) return taskList[b].prio-taskList[a].prio;
			return taskList[a].ow-taskList[b].ow; 
		});
	// sortByDateModified (reverse)
	else if(curList.sort == 104) taskOrder.sort( function(a,b){
			if(taskList[a].compl != taskList[b].compl) return taskList[a].compl-taskList[b].compl;
			if(taskList[a].dateEditedInt != taskList[b].dateEditedInt) return taskList[b].dateEditedInt-taskList[a].dateEditedInt;
			if(taskList[a].prio != taskList[b].prio) return taskList[a].prio-taskList[b].prio;
			return taskList[b].ow-taskList[a].ow; 
		});		
	else return;
	if(oldOrder.toString() == taskOrder.toString()) return;
	if(id && taskList[id])
	{
		// optimization: determine where to insert task: top or after some task
		var indx = $.inArray(id,taskOrder);
		if(indx ==0) {
			$('#tasklist').prepend($('#taskrow_'+id))
		} else {
			var after = taskOrder[indx-1];
			$('#taskrow_'+after).after($('#taskrow_'+id));
		}
	}
	else {
		var o = $('#tasklist');
		for(var i in taskOrder) {
			o.append($('#taskrow_'+taskOrder[i]));
		}
	}
};


function prioPopup(act, el, id)
{
	if(act == 0) {
		clearTimeout(objPrio.timer);
		return;
	}
	var offset = $(el).offset();
	$('#priopopup').css({ position: 'absolute', top: offset.top + 1, left: offset.left + 1 });
	objPrio.taskId = id;
	objPrio.el = el;
	objPrio.timer = setTimeout("$('#priopopup').show()", 300);
};

function prioClick(prio, el)
{
	el.blur();
	prio = parseInt(prio);
	$('#priopopup').fadeOut('fast'); //.hide();
	setTaskPrio(objPrio.taskId, prio);
};

function setTaskPrio(id, prio)
{
	_mtt.db.request('setPrio', {id:id, prio:prio});
	taskList[id].prio = prio;
	var $t = $('#taskrow_'+id);
	$t.find('.task-prio').replaceWith(preparePrio(prio, id));
	if(curList.sort != 0) changeTaskOrder(id);
	$t.effect("highlight", {color:_mtt.theme.editTaskFlashColor}, 'normal');
};

function setSort(v, init)
{
	$('#listmenucontainer .sort-item').removeClass('mtt-item-checked').children('.mtt-sort-direction').text('');
	if(v == 0) $('#sortByHand').addClass('mtt-item-checked');
	else if(v==1 || v==101) $('#sortByPrio').addClass('mtt-item-checked').children('.mtt-sort-direction').text(v==1 ? '↑' : '↓');
	else if(v==2 || v==102) $('#sortByDueDate').addClass('mtt-item-checked').children('.mtt-sort-direction').text(v==2 ? '↑' : '↓');
	else if(v==3 || v==103) $('#sortByDateCreated').addClass('mtt-item-checked').children('.mtt-sort-direction').text(v==3 ? '↓' : '↑');
	else if(v==4 || v==104) $('#sortByDateModified').addClass('mtt-item-checked').children('.mtt-sort-direction').text(v==4 ? '↓' : '↑');
	else return;

	curList.sort = v;
	//if(v == 0 && !flag.readOnly) $("#tasklist").sortable('enable');
	//else $("#tasklist").sortable('disable');
	
	if(!init)
	{
		changeTaskOrder();
		if(!flag.readOnly) _mtt.db.request('setSort', {list:curList.id, sort:curList.sort});
	}
};


function changeTaskCnt(task, dir, old)
{
	if(dir > 0) dir = 1;
	else if(dir < 0) dir = -1;
	if(dir == 0 && old != null && task.dueClass != old.dueClass) //on saveTask
	{
		if(old.dueClass != '') taskCnt[old.dueClass]--;
		if(task.dueClass != '') taskCnt[task.dueClass]++;
	}
	else if(dir == 0 && old == null) //on comleteTask
	{
		if(!curList.showCompl && task.compl) taskCnt.total--;
		if(task.dueClass != '') taskCnt[task.dueClass] += task.compl ? -1 : 1;
	}
	if(dir != 0) {
		if(task.dueClass != '' && !task.compl) taskCnt[task.dueClass] += dir;
		taskCnt.total += dir;
	}
};

function refreshTaskCnt()
{
	$('#cnt_total').text(taskCnt.total);
	$('#cnt_past').text(taskCnt.past);
	$('#cnt_today').text(taskCnt.today);
	$('#cnt_soon').text(taskCnt.soon);
	if(filter.due == '') $('#total').text(taskCnt.total);
	else if(taskCnt[filter.due] != null) $('#total').text(taskCnt[filter.due]);
};


function setTaskview(v)
{
	if(v == 0)
	{
		if(filter.due == '') return;
		$('#taskview .btnstr').text(_mtt.lang.get('tasks'));
		$('#tasklist').removeClass('filter-'+filter.due);
		filter.due = '';
		$('#total').text(taskCnt.total);
	}
	else if(v=='past' || v=='today' || v=='soon')
	{
		if(filter.due == v) return;
		else if(filter.due != '') {
			$('#tasklist').removeClass('filter-'+filter.due);
		}
		$('#tasklist').addClass('filter-'+v);
		$('#taskview .btnstr').text(_mtt.lang.get('f_'+v));
		$('#total').text(taskCnt[v]);
		filter.due = v;
	}
};


function toggleAllNotes(show)
{
	for(var id in taskList)
	{
		if(taskList[id].note == '') continue;
		if(show) $('#taskrow_'+id).addClass('task-expanded');
		else $('#taskrow_'+id).removeClass('task-expanded');
	}
	curList.showNotes = show;
	if(_mtt.options.saveShowNotes) _mtt.db.request('setShowNotesInList', {list:curList.id, shownotes:show}, function(json){});
};


function tabSelect(elementOrId)
{
	var id;
	if(typeof elementOrId == 'number') id = elementOrId;
	else if(typeof elementOrId == 'string') id = parseInt(elementOrId);
	else {
		id = $(elementOrId).attr('id');
		if(!id) return;
		id = parseInt(id.split('_', 2)[1]);
	}
	if(!tabLists.exists(id)) return;
	$('#lists .mtt-tabs-selected').removeClass('mtt-tabs-selected');
	$('#list_all').removeClass('mtt-tabs-selected');
	
	if(id == -1) {
		$('#list_all').addClass('mtt-tabs-selected').removeClass('mtt-tabs-hidden');
		$('#listmenucontainer .mtt-need-real-list').addClass('mtt-item-hidden');
	}
	else {
		$('#list_'+id).addClass('mtt-tabs-selected').removeClass('mtt-tabs-hidden');
		$('#listmenucontainer .mtt-need-real-list').removeClass('mtt-item-hidden');
	}
	
	if(curList.id != id)
	{
		if(id == -1) $('#mtt_body').addClass('show-all-tasks');
		else $('#mtt_body').removeClass('show-all-tasks');
		if(filter.search != '') liveSearchToggle(0, 1);
		mytinytodo.doAction('listSelected', tabLists.get(id));
	}
	curList = tabLists.get(id);
	if(curList.hidden) {
		curList.hidden = false;
		if(curList.id > 0) _mtt.db.request('setHideList', {list:curList.id, hide:0});
	}
	flag.tagsChanged = true;
	cancelTagFilter(0, 1);
	setTaskview(0);
	loadTasks({clearTasklist:1});
};



function listMenu(el)
{
	if(!mytinytodo.menus.listMenu) mytinytodo.menus.listMenu = new mttMenu('listmenucontainer', {onclick:listMenuClick});
	mytinytodo.menus.listMenu.show(el);
};

function listMenuClick(el, menu)
{
	if(!el.id) return;
	switch(el.id) {
		case 'btnAddList': addList(); break;
		case 'btnRenameList': renameCurList(); break;
		case 'btnDeleteList': deleteCurList(); break;
		case 'btnPublish': publishCurList(); break;
		case 'btnExportCSV': exportCurList('csv'); break;
		case 'btnExportICAL': exportCurList('ical'); break;
		case 'btnRssFeed': feedCurList(); break;
		case 'btnShowCompleted': showCompletedToggle(); break;
		case 'btnClearCompleted': clearCompleted(); break;
		case 'sortByHand': setSort(0); break;
		case 'sortByPrio': setSort(curList.sort==1 ? 101 : 1); break;
		case 'sortByDueDate': setSort(curList.sort==2 ? 102 : 2); break;
		case 'sortByDateCreated': setSort(curList.sort==3 ? 103 : 3); break;
		case 'sortByDateModified': setSort(curList.sort==4 ? 104 : 4); break;
	}
};

function deleteTask(id)
{
	if(!confirm(_mtt.lang.get('confirmDelete'))) {
		return false;
	}
	_mtt.db.request('deleteTask', {id:id}, function(json){
		if(!parseInt(json.total)) return;
		var item = json.list[0];
		taskOrder.splice($.inArray(id,taskOrder), 1);
		$('#taskrow_'+id).fadeOut('normal', function(){ $(this).remove() });
		changeTaskCnt(taskList[id], -1);
		refreshTaskCnt();
		delete taskList[id];
	});
	flag.tagsChanged = true;
	return false;
};

function completeTask(id, ch)
{
	if(!taskList[id]) return; //click on already removed from the list while anim. effect
	var compl = taskList[id].compl ? 0 : 1;
	//if(ch.checked) compl = 1;
	_mtt.db.request('completeTask', {id:id, compl:compl, list:curList.id}, function(json){
		if(!parseInt(json.total)) return;
		var item = json.list[0];
		if(item.compl) $('#taskrow_'+id).addClass('task-completed');
		else $('#taskrow_'+id).removeClass('task-completed');
		taskList[id] = item;
		changeTaskCnt(taskList[id], 0);
		if(item.compl && !curList.showCompl) {
			delete taskList[id];
			taskOrder.splice($.inArray(id,taskOrder), 1);
			$('#taskrow_'+id).fadeOut('normal', function(){ $(this).remove() });
		}
		else if(curList.showCompl) {
			$('#taskrow_'+item.id).replaceWith(prepareTaskStr(taskList[id]));
            $('#tasklist').collapsibleset("refresh");
			$('#taskrow_'+id).fadeOut('fast', function(){	
				changeTaskOrder(id);				
				$(this).effect("highlight", {color:_mtt.theme.editTaskFlashColor}, 'normal', function(){$(this).css('display','')});
			});
            $('#taskrow_'+item.id).on('expand', function(event,ui){
                console.log("show menu on expand, id=" + this.id);
                taskContextMenu(this, this.id.split('_',2)[1]);
            });
		}
		refreshTaskCnt();
	});
	return false;
};

function toggleTaskNote(id)
{
	var aArea = '#tasknotearea'+id;
	if($(aArea).css('display') == 'none')
	{
		$('#notetext'+id).val(taskList[id].noteText);
		$(aArea).show();
		$('#tasknote'+id).hide();
		$('#taskrow_'+id).addClass('task-expanded');
		$('#notetext'+id).focus();
	} else {
		cancelTaskNote(id)
	}
	return false;
};

function cancelTaskNote(id)
{
	if(taskList[id].note == '') $('#taskrow_'+id).removeClass('task-expanded');
	$('#tasknotearea'+id).hide();
	$('#tasknote'+id).show();
	return false;
};

function saveTaskNote(id)
{
	_mtt.db.request('editNote', {id:id, note:$('#notetext'+id).val()}, function(json){
		if(!parseInt(json.total)) return;
		var item = json.list[0];
		taskList[id].note = item.note;
		taskList[id].noteText = item.noteText;
		$('#tasknote'+id+'>span').html(prepareHtml(item.note));
		if(item.note == '') $('#taskrow_'+id).removeClass('task-has-note task-expanded');
		else $('#taskrow_'+id).addClass('task-has-note task-expanded');
		cancelTaskNote(id);
	});
	return false;
};

function editTask(id)
{
	var item = taskList[id];
	if(!item) return false;
	// no need to clear form
	var form = document.getElementById('taskedit_form');
	form.task.value = dehtml(item.title);
	form.note.value = item.noteText;
	form.id.value = item.id;
	form.tags.value = item.tags.split(',').join(', ');
	form.duedate.value = convertFormat4DatePicker(item.dueInt);
	form.prio.value = item.prio;
    $('#page_taskedit #taskedit_form #prio').selectmenu('refresh');
	//$('#taskedit-date .date-created>span').text(item.date);
	//if(item.compl) $('#taskedit-date .date-completed').show().find('span').text(item.dateCompleted);
	//else $('#taskedit-date .date-completed').hide();
	//toggleEditAllTags(0);
	showEditForm();
	return false;
};

function clearEditForm()
{
	var form = document.getElementById('taskedit_form');
	form.task.value = '';
	form.note.value = '';
	form.tags.value = '';
	form.duedate.value = '';
	form.prio.value = '0';
	form.id.value = '';
	toggleEditAllTags(0);
};

function showEditForm(isAdd)
{
	var form = document.getElementById('taskedit_form');
    var headerText = document.getElementById('header_title_edit_task');
	if(isAdd)
	{
        headerText.innerHTML = 'Add Task';
		clearEditForm();
		$('#page_taskedit').removeClass('mtt-inedit').addClass('mtt-inadd');
		form.isadd.value = 1;
		if(_mtt.options.autotag) form.tags.value = _mtt.filter.getTags();
		if($('#task').val() != '')
		{
			_mtt.db.request('parseTaskStr', { list:curList.id, title:$('#task').val(), tag:_mtt.filter.getTags() }, function(json){
				if(!json) return;
				form.task.value = json.title
				form.tags.value = (form.tags.value != '') ? form.tags.value +', '+ json.tags : json.tags;
				form.prio.value = json.prio;
				$('#task').val('');

			});
		}
	}
	else {
        headerText.innerHTML = 'Edit Task';
		$('#page_taskedit').removeClass('mtt-inadd').addClass('mtt-inedit');
		form.isadd.value = 0;
	}

	flag.editFormChanged = false;
	_mtt.pageSet('taskedit');
};

function saveTask(form)
{
	if(flag.readOnly) return false;
	if(form.isadd.value != 0)
		return submitFullTask(form);

	_mtt.db.request('editTask', {id:form.id.value, title: form.task.value, note:form.note.value,
		prio:form.prio.value, tags:form.tags.value, duedate:form.duedate.value},
		function(json){
			if(!parseInt(json.total)) return;
			var item = json.list[0];
			changeTaskCnt(item, 0, taskList[item.id]);
			taskList[item.id] = item;
			var noteExpanded = (item.note != '' && $('#taskrow_'+item.id).is('.task-expanded')) ? 1 : 0;
			$('#taskrow_'+item.id).replaceWith(prepareTaskStr(item, noteExpanded));
            $('#tasklist').collapsibleset("refresh");
			if(curList.sort != 0) changeTaskOrder(item.id);
            $('#taskrow_'+item.id).on('expand', function(event,ui){
                console.log("show menu on expand, id=" + this.id);
                taskContextMenu(this, this.id.split('_',2)[1]);
            });
            $('#taskrow_'+item.id).trigger('expand');
			_mtt.pageBack(); //back to list
			refreshTaskCnt();
			$('#taskrow_'+item.id).effect("highlight", {color:_mtt.theme.editTaskFlashColor}, 'normal', function(){$(this).css('display','')});
	});
	$("#edittags").flushCache();
	flag.tagsChanged = true;
	return false;
};

function toggleEditAllTags(show)
{
	if(show)
	{
		if(curList.id == -1) {
			var taskId = document.getElementById('taskedit_form').id.value;
			loadTags(taskList[taskId].listId, fillEditAllTags);
		}
		else if(flag.tagsChanged) loadTags(curList.id, fillEditAllTags);
		else fillEditAllTags();
		showhide($('#alltags_hide'), $('#alltags_show'));
	}
	else {
		$('#alltags').hide();
		showhide($('#alltags_show'), $('#alltags_hide'))
	}
};

function fillEditAllTags()
{
	var a = [];
	for(var i=tagsList.length-1; i>=0; i--) { 
		a.push('<a href="#" class="tag" tag="'+tagsList[i].tag+'">'+tagsList[i].tag+'</a>');
	}
	$('#alltags .tags-list').html(a.join(', '));
	$('#alltags').show();
};

function addEditTag(tag)
{
	var v = $('#edittags').val();
	if(v == '') { 
		$('#edittags').val(tag);
		return;
	}
	var r = v.search(new RegExp('(^|,)\\s*'+tag+'\\s*(,|$)'));
	if(r < 0) $('#edittags').val(v+', '+tag);
};

function loadTags(listId, callback)
{
	_mtt.db.request('tagCloud', {list:listId}, function(json){
		if(!parseInt(json.total)) tagsList = [];
		else tagsList = json.cloud;
		var cloud = '';
		$.each(tagsList, function(i,item){
			cloud += ' <a href="#" tag="'+item.tag+'" tagid="'+item.id+'" class="tag w'+item.w+'" >'+item.tag+'</a>';
		});
		$('#tagcloudcontent').html(cloud)
		flag.tagsChanged = false;
		callback();
	});
};

function cancelTagFilter(tagId, dontLoadTasks)
{
	if(tagId)  _mtt.filter.cancelTag(tagId);
	else _mtt.filter.clear();
	if(dontLoadTasks==null || !dontLoadTasks) loadTasks();
};

function addFilterTag(tag, tagId, exclude)
{
	if(!_mtt.filter.addTag(tagId, tag, exclude)) return false;
	loadTasks();
};

function liveSearchToggle(toSearch, dontLoad)
{
	if(toSearch)
	{
		$('#search').focus();
	}
	else
	{
		if($('#search').val() != '') {
			filter.search = '';
			$('#search').val('');
			$('#searchbarkeyword').text('');
			$('#searchbar').hide();
			$('#search_close').hide();
			if(!dontLoad) loadTasks();
		}
		
		$('#search').blur();
	}
};

function searchTasks(force)
{
	var newkeyword = $('#search').val();
	if(newkeyword == filter.search && !force) return false;
	filter.search = newkeyword;
	$('#searchbarkeyword').text(filter.search);
	if(filter.search != '') $('#searchbar').fadeIn('fast');
	else $('#searchbar').fadeOut('fast');
	loadTasks();
	return false;
};


function submitFullTask(form)
{
	if(flag.readOnly) return false;

	_mtt.db.request('fullNewTask', { list:curList.id, tag:_mtt.filter.getTags(), title: form.task.value, note:form.note.value,
			prio:form.prio.value, tags:form.tags.value, duedate:form.duedate.value }, function(json){
		if(!parseInt(json.total)) return;
		form.task.value = '';
		var item = json.list[0];
		taskList[item.id] = item;
		taskOrder.push(parseInt(item.id));
		$('#tasklist').append(prepareTaskStr(item));
		$('#tasklist').collapsibleset("refresh");
		changeTaskOrder(item.id);
        $('#taskrow_'+item.id).on('expand', function(event,ui){
            console.log("show menu on expand, id=" + this.id);
            taskContextMenu(this, this.id.split('_',2)[1]);
        });
        $('#taskrow_'+item.id).trigger('expand');
		_mtt.pageBack();
		$('#taskrow_'+item.id).effect("highlight", {color:_mtt.theme.newTaskFlashColor}, 2000);
		changeTaskCnt(item, 1);
		refreshTaskCnt();
	});

	$("#edittags").flushCache();
	flag.tagsChanged = true;
	return false;
};


function sortStart(event,ui)
{
	// remember initial order before sorting
	//sortOrder = $(this).sortable('toArray');
};

function orderChanged(event,ui)
{
	if(!ui.item[0]) return;
	var itemId = ui.item[0].id;
	//var n = $(this).sortable('toArray');

	// remove possible empty id's
	for(var i=0; i<sortOrder.length; i++) {
		if(sortOrder[i] == '') { sortOrder.splice(i,1); i--; }
	}
	if(n.toString() == sortOrder.toString()) return;

	// make index: id=>position
	var h0 = {}; //before
	for(var j=0; j<sortOrder.length; j++) {
		h0[sortOrder[j]] = j;
	}
	var h1 = {}; //after
	for(var j=0; j<n.length; j++) {
		h1[n[j]] = j;
		taskOrder[j] = parseInt(n[j].split('_')[1]);
	}

	// prepare param
	var o = [];
	var diff;
	var replaceOW = taskList[sortOrder[h1[itemId]].split('_')[1]].ow;
	for(var j in h0)
	{
		diff = h1[j] - h0[j];
		if(diff != 0) {
			var a = j.split('_');
			if(j == itemId) diff = replaceOW - taskList[a[1]].ow;
			o.push({id:a[1], diff:diff});
			taskList[a[1]].ow += diff;
		}
	}

	_mtt.db.request('changeOrder', {order:o});
};


function mttMenu(container, options)
{
	var menu = this;
	this.container = document.getElementById(container);
	this.$container = $(this.container);
	this.menuOpen = false;
	this.options = options || {};
	this.submenu = [];
	this.curSubmenu = null;
	this.showTimer = null;
	this.ts = (new Date).getTime();
	this.container.mttmenu = this.ts;

	this.$container.find('li').click(function(){
		menu.onclick(this, menu);
		return false;
	})
	.each(function(){

		var submenu = 0;
		if($(this).is('.mtt-menu-indicator'))
		{
			submenu = new mttMenu($(this).attr('submenu'));
			submenu.$caller = $(this);
			submenu.parent = menu;
			if(menu.root) submenu.root = menu.root;	//!! be careful with circular references
			else submenu.root = menu;
			menu.submenu.push(submenu);
			submenu.ts = submenu.container.mttmenu = submenu.root.ts;

			submenu.$container.find('li').click(function(){
				submenu.root.onclick(this, submenu);
				return false;
			});
		}

		$(this).hover(
			function(){
				if(!$(this).is('.mtt-menu-item-active')) menu.$container.find('li').removeClass('mtt-menu-item-active');
				clearTimeout(menu.showTimer);
				if(menu.hideTimer && menu.parent) {
					clearTimeout(menu.hideTimer);
					menu.hideTimer = null;
					menu.$caller.addClass('mtt-menu-item-active');
					clearTimeout(menu.parent.showTimer);
				}

				if(menu.curSubmenu && menu.curSubmenu.menuOpen && menu.curSubmenu != submenu && !menu.curSubmenu.hideTimer)
				{
					menu.$container.find('li').removeClass('mtt-menu-item-active');
					var curSubmenu = menu.curSubmenu;
					curSubmenu.hideTimer = setTimeout(function(){
						curSubmenu.hide();
						curSubmenu.hideTimer = null;
					}, 300);
				}

				if(!submenu || menu.curSubmenu == submenu && menu.curSubmenu.menuOpen)
					return;
			
				menu.showTimer = setTimeout(function(){
					menu.curSubmenu = submenu;
					submenu.showSub();
				}, 400);
			},
			function(){}
		);

	});

	this.onclick = function(item, fromMenu)
	{
		if($(item).is('.mtt-item-disabled,.mtt-menu-indicator,.mtt-item-hidden')) return;
		menu.close();
		if(this.options.onclick) this.options.onclick(item, fromMenu);
	};

	this.hide = function()
	{
		for(var i in this.submenu) this.submenu[i].hide();
		clearTimeout(this.showTimer);
		this.$container.hide();
		this.$container.find('li').removeClass('mtt-menu-item-active');
		this.menuOpen = false;
	};

	this.close = function(event)
	{
		if(!this.menuOpen) return;
		if(event)
		{
			// ignore if event (click) was on caller or container
			var t = event.target;
			if(t == this.caller || (t.mttmenu && t.mttmenu == this.ts)) return;
			while(t.parentNode) {
				if(t.parentNode == this.caller || (t.mttmenu && t.mttmenu == this.ts)) return;
				t = t.parentNode;
			}
		}
		this.hide();
		$(this.caller).removeClass('mtt-menu-button-active');
		$(document).unbind('mousedown.mttmenuclose');
	};

	this.show = function(caller)
	{
		if(this.menuOpen)
		{
			this.close();
			if(this.caller && this.caller == caller) return;
		}
		$(document).triggerHandler('mousedown.mttmenuclose'); //close any other open menu
		this.caller = caller;
		var $caller = $(caller);
		
		// beforeShow trigger
		if(this.options.beforeShow && this.options.beforeShow.call)
			this.options.beforeShow();

		// adjust width
		if(this.options.adjustWidth && this.$container.outerWidth(true) > $(window).width())
			this.$container.width($(window).width() - (this.$container.outerWidth(true) - this.$container.width()));

		$caller.addClass('mtt-menu-button-active');
		var offset = $caller.offset();
		var x2 = $(window).width() + $(document).scrollLeft() - this.$container.outerWidth(true) - 1;
		var x = offset.left < x2 ? offset.left : x2;
		if(x<0) x=0;
		var y = offset.top+caller.offsetHeight-1;
		if(y + this.$container.outerHeight(true) > $(window).height() + $(document).scrollTop()) y = offset.top - this.$container.outerHeight();
		if(y<0) y=0;
		this.$container.css({ position: 'absolute', top: y, left: x, width:this.$container.width() /*, 'min-width': $caller.width()*/ }).show();
		var menu = this;
		$(document).bind('mousedown.mttmenuclose', function(e){ menu.close(e) });
		this.menuOpen = true;
	};

	this.showSub = function()
	{
		this.$caller.addClass('mtt-menu-item-active');
		var offset = this.$caller.offset();
		var x = offset.left+this.$caller.outerWidth();
		if(x + this.$container.outerWidth(true) > $(window).width() + $(document).scrollLeft()) x = offset.left - this.$container.outerWidth() - 1;
		if(x<0) x=0;
		var y = offset.top + this.parent.$container.offset().top-this.parent.$container.find('li:first').offset().top;
		if(y +  this.$container.outerHeight(true) > $(window).height() + $(document).scrollTop()) y = $(window).height() + $(document).scrollTop()- this.$container.outerHeight(true) - 1;
		if(y<0) y=0;
		this.$container.css({ position: 'absolute', top: y, left: x, width:this.$container.width() /*, 'min-width': this.$caller.outerWidth()*/ }).show();
		this.menuOpen = true;
	};

	this.destroy = function()
	{
		for(var i in this.submenu) {
			this.submenu[i].destroy();
			delete this.submenu[i];
		}
		this.$container.find('li').unbind(); //'click mouseenter mouseleave'
	};
};


function taskContextMenu(el, id)
{
	if(_mtt.menus.cmenu) _mtt.menus.cmenu.destroy();
	_mtt.menus.cmenu = null;
	_mtt.menus.cmenu = new mttMenu('taskcontextcontainer_'+id, {
		onclick: taskContextClick,
		beforeShow: function() {
			$('#cmenupriocontainer li').removeClass('mtt-item-checked');
			$('#cmenu_prio\\:'+ taskList[_mtt.menus.cmenu.tag].prio).addClass('mtt-item-checked');
		}
	});
    $('#taskrow_'+id+' #cmenu_task_complete_'+id).button();
    $('#taskrow_'+id+' #cmenu_edit_'+id).button();
    $('#taskrow_'+id+' #cmenu_task_move_'+id).button();
	_mtt.menus.cmenu.tag = id;
	//_mtt.menus.cmenu.show(el);
};

function taskContextClick(el, menu)
{
	if(!el.id) return;
	var taskId = parseInt(_mtt.menus.cmenu.tag);
	var id = el.id, value;
	var a = id.split(':');
	if(a.length == 2) {
		id = a[0];
		value = a[1];
	}
	switch(id) {
		case 'cmenu_edit': editTask(taskId); break;
		case 'cmenu_note': toggleTaskNote(taskId); break;
		case 'cmenu_delete': deleteTask(taskId); break;
		case 'cmenu_prio': setTaskPrio(taskId, parseInt(value)); break;
        case 'cmenu_task_move': handleMoveTaskButtonClicked(); break;
        case 'cmenu_task_complete': completeTask(taskId, el); break;
		case 'cmenu_list':
			if(menu.$caller && menu.$caller.attr('id')=='cmenu_move') moveTaskToList(taskId, value);
			break;
	}
};


function moveTaskToList(taskId, listId)
{
	if(curList.id == listId) return;
	_mtt.db.request('moveTask', {id:taskId, from:curList.id, to:listId}, function(json){
		if(!parseInt(json.total)) return;
		if(curList.id == -1)
		{
			// leave the task in current tab (all tasks tab)
			var item = json.list[0];
			changeTaskCnt(item, 0, taskList[item.id]);
			taskList[item.id] = item;
			var noteExpanded = (item.note != '' && $('#taskrow_'+item.id).is('.task-expanded')) ? 1 : 0;
			$('#taskrow_'+item.id).replaceWith(prepareTaskStr(item, noteExpanded));
            $('#tasklist').collapsibleset("refresh");
            $('#taskrow_'+item.id).on('expand', function(event,ui){
                console.log("show menu on expand, id=" + this.id);
                taskContextMenu(this, this.id.split('_',2)[1]);
            });
			if(curList.sort != 0) changeTaskOrder(item.id);
			refreshTaskCnt();
			$('#taskrow_'+item.id).effect("highlight", {color:_mtt.theme.editTaskFlashColor}, 'normal', function(){$(this).css('display','')});
		}
		else {
			// remove the task from currrent tab
			changeTaskCnt(taskList[taskId], -1)
			delete taskList[taskId];
			taskOrder.splice($.inArray(taskId,taskOrder), 1);
			$('#taskrow_'+taskId).fadeOut('normal', function(){ $(this).remove() });
			refreshTaskCnt();
		}
	});

	$("#edittags").flushCache();
	flag.tagsChanged = true;
};


function cmenuOnListsLoaded()
{
	if(_mtt.menus.cmenu) _mtt.menus.cmenu.destroy();
	_mtt.menus.cmenu = null;
	var s = '';
	var all = tabLists.getAll();
	for(var i in all) {
		s += '<li id="cmenu_list:'+all[i].id+'" class="'+(all[i].hidden?'mtt-list-hidden':'')+'">'+
            '<a id="cmenu_list_item" href="#">'+all[i].name+'</a>'+
            '</li>';
	}
	$('#cmenulistscontainer ul').html(s);
    $('#cmenulistscontainer ul').listview("refresh");

    $(document).off('click', '#cmenulistscontainer li');
    $(document).on('click', '#cmenulistscontainer li', function(){
        onMoveToListClicked(this);
    });
};

function cmenuOnListAdded(list)
{
	if(_mtt.menus.cmenu) _mtt.menus.cmenu.destroy();
	_mtt.menus.cmenu = null;
	$('#cmenulistscontainer ul').append('<li id="cmenu_list:'+list.id+'">'+list.name+'</li>');
};

function cmenuOnListRenamed(list)
{
	$('#cmenu_list\\:'+list.id).text(list.name);
};

function cmenuOnListSelected(list)
{
	$('#cmenulistscontainer li').removeClass('mtt-item-disabled');
	$('#cmenu_list\\:'+list.id).addClass('mtt-item-disabled').removeClass('mtt-list-hidden');
};

function cmenuOnListOrderChanged()
{
	cmenuOnListsLoaded();
	$('#cmenu_list\\:'+curList.id).addClass('mtt-item-disabled');
};

function cmenuOnListHidden(list)
{
	$('#cmenu_list\\:'+list.id).addClass('mtt-list-hidden');
};


function tabmenuOnListSelected(list)
{
	if(list.published) {
		$('#btnPublish').addClass('mtt-item-checked');
		$('#btnRssFeed').removeClass('mtt-item-disabled');
	}
	else {
		$('#btnPublish').removeClass('mtt-item-checked');
		$('#btnRssFeed').addClass('mtt-item-disabled');
	}
	if(list.showCompl) $('#btnShowCompleted').addClass('mtt-item-checked');
	else $('#btnShowCompleted').removeClass('mtt-item-checked');
};


function listOrderChanged(event, ui)
{
	//var a = $(this).sortable("toArray");
	var order = [];
	for(var i in a) {
		order.push(a[i].split('_')[1]);
	}
	tabLists.reorder(order);
	_mtt.db.request('changeListOrder', {order:order});
	_mtt.doAction('listOrderChanged', {order:order});
};

function showCompletedToggle()
{
	var act = curList.showCompl ? 0 : 1;
	curList.showCompl = tabLists.get(curList.id).showCompl = act;
	if(act) $('#btnShowCompleted').addClass('mtt-item-checked');
	else $('#btnShowCompleted').removeClass('mtt-item-checked');
	loadTasks({setCompl:1});
};

function clearCompleted()
{
	if(!curList) return false;
	var r = confirm(_mtt.lang.get('clearCompleted'));
	if(!r) return;
	_mtt.db.request('clearCompletedInList', {list:curList.id}, function(json){
		if(!parseInt(json.total)) return;
		flag.tagsChanged = true;
		if(curList.showCompl) loadTasks();
	});
};

function tasklistClick(e)
{
	var node = e.target.nodeName.toUpperCase();
	if(node=='SPAN' || node=='LI' || node=='DIV')
	{
		var li =  findParentNode(e.target, 'LI');
		if(li) {
			if(selTask && li.id != selTask) $('#'+selTask).removeClass('clicked doubleclicked');
			selTask = li.id;
			if($(li).is('.clicked')) $(li).toggleClass('doubleclicked');
			else $(li).addClass('clicked');
		}
	}
};


function showhide(a,b)
{
	a.show();
	b.hide();
};

function findParentNode(el, node)
{
	// in html nodename is in uppercase, in xhtml nodename in in lowercase
	if(el.nodeName.toUpperCase() == node) return el;
	if(!el.parentNode) return null;
	while(el.parentNode) {
		el = el.parentNode;
		if(el.nodeName.toUpperCase() == node) return el;
	}
};

function getLiTaskId(el)
{
	var li = findParentNode(el, 'LI');
	if(!li || !li.id) return 0;
	return li.id.split('_',2)[1];
};

function isParentId(el, id)
{
	if(el.id && $.inArray(el.id, id) != -1) return true;
	if(!el.parentNode) return null;
	return isParentId(el.parentNode, id);
};

function dehtml(str)
{
	return str.replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
};


function slmenuOnListsLoaded()
{
	if(_mtt.menus.selectlist) {
		_mtt.menus.selectlist.destroy();
		_mtt.menus.selectlist = null;
	}

	var s = '';
	var all = tabLists.getAll();
	for(var i in all) {
		s += '<li id="slmenu_list:'+all[i].id+'" class="'+(all[i].id==curList.id?'mtt-item-checked':'')+' list-id-'+all[i].id+(all[i].hidden?' mtt-list-hidden':'')+'"><div class="menu-icon"></div><a href="#list/'+all[i].id+'">'+all[i].name+'</a></li>';
	}
	$('#slmenucontainer ul>.slmenu-lists-begin').nextAll().remove();
	$('#slmenucontainer ul>.slmenu-lists-begin').after(s);
};

function slmenuOnListRenamed(list)
{
	$('#slmenucontainer li.list-id-'+list.id).find('a').html(list.name);
};

function slmenuOnListAdded(list)
{
	if(_mtt.menus.selectlist) {
		_mtt.menus.selectlist.destroy();
		_mtt.menus.selectlist = null;
	}
	$('#slmenucontainer ul').append('<li id="slmenu_list:'+list.id+'" class="list-id-'+list.id+'"><div class="menu-icon"></div><a href="#list/'+list.id+'">'+list.name+'</a></li>');
};

function slmenuOnListSelected(list)
{
	$('#slmenucontainer li').removeClass('mtt-item-checked');
	$('#slmenucontainer li.list-id-'+list.id).addClass('mtt-item-checked').removeClass('mtt-list-hidden');

};

function slmenuOnListHidden(list)
{
	$('#slmenucontainer li.list-id-'+list.id).addClass('mtt-list-hidden');
};

function slmenuSelect(el, menu)
{
	if(!el.id) return;
	var id = el.id, value;
	var a = id.split(':');
	if(a.length == 2) {
		id = a[0];
		value = a[1];
	}
	if(id == 'slmenu_list') {
		tabSelect(parseInt(value));
	}
	return false;
};


function exportCurList(format)
{
	if(!curList) return;
	if(!format.match(/^[a-z0-9-]+$/i)) return;
	window.location.href = _mtt.mttUrl + 'export.php?list='+curList.id +'&format='+format;
};

function feedCurList()
{
	if(!curList) return;
	window.location.href = _mtt.mttUrl + 'feed.php?list='+curList.id;
}

function hideTab(listId)
{
	if(typeof listId != 'number') {
		var id = $(listId).attr('id');
		if(!id) return;
		listId = parseInt(id.split('_', 2)[1]);
	}
	
	if(!tabLists.get(listId)) return false;

	// if we hide current tab
	var listIdToSelect = 0;
	if(curList.id == listId) {
		var all = tabLists.getAll();
		for(var i in all) {
			if(all[i].id != curList.id && !all[i].hidden) {
				listIdToSelect = all[i].id;
				break;
			}
		}
		// do not hide the tab if others are hidden
		if(!listIdToSelect) return false;
	}

	if(listId == -1) {
		$('#list_all').addClass('mtt-tabs-hidden').removeClass('mtt-tabs-selected');
	}
	else {
		$('#list_'+listId).addClass('mtt-tabs-hidden').removeClass('mtt-tabs-selected');
	}
	
	tabLists.get(listId).hidden = true;
	
	if(listId > 0) {
		_mtt.db.request('setHideList', {list:listId, hide:1});
		_mtt.doAction('listHidden', tabLists.get(listId));
	}
	
	if(listIdToSelect) {
		tabSelect(listIdToSelect);
	}
}

/*
	Errors and Info messages
*/

function flashError(str, details)
{
	$("#msg>.msg-text").text(str)
	$("#msg>.msg-details").text(details);
	$("#loading").hide();
	$("#msg").addClass('mtt-error').effect("highlight", {color:_mtt.theme.msgFlashColor}, 700);
}

function flashInfo(str, details)
{
	$("#msg>.msg-text").text(str)
	$("#msg>.msg-details").text(details);
	$("#loading").hide();
	$("#msg").addClass('mtt-info').effect("highlight", {color:_mtt.theme.msgFlashColor}, 700);
}

function toggleMsgDetails()
{
	var el = $("#msg>.msg-details");
	if(!el) return;
	if(el.css('display') == 'none') el.show();
	else el.hide()
}


/*
	Authorization
*/
function updateAccessStatus()
{
    if(flag.needAuth && !flag.isLogged) {
        $('#settings_bar_login').show();
        $('#settings_bar_logout').hide();
    } else {
        $('#settings_bar_login').hide();
        $('#settings_bar_logout').show();
    }
}

function showAuth(el)
{
	var w = $('#authform');
	if(w.css('display') == 'none')
	{
		var offset = $(el).offset();
		w.css({
			position: 'absolute',
			top: offset.top + el.offsetHeight + 3,
			left: offset.left + el.offsetWidth - w.outerWidth()
		}).show();
		$('#password').focus();
	}
	else {
		w.hide();
		el.blur();
	}
}

function doAuth(form)
{
    $('#popupLogin').popup('close');

	$.post(mytinytodo.mttUrl+'ajax.php?login', { login:1, password: form.password.value }, function(json){
		form.password.value = '';
		if(json.logged)
		{
			flag.isLogged = true;
			window.location.reload();
		}
		else {
			//flashError(_mtt.lang.get('invalidpass'));
			//$('#password').focus();
            setTimeout(function() {showMessageDialog(_mtt.lang.get('invalidpass'));}, 500);
		}
	}, 'json');
	//$('#authform').hide();
}

function logout()
{
	$.post(mytinytodo.mttUrl+'ajax.php?logout', { logout:1 }, function(json){
		flag.isLogged = false;
		window.location.reload();
	}, 'json');
	return false;
} 


/*
	Settings
*/

function showSettings()
{
	if(_mtt.pages.current.page == 'ajax' && _mtt.pages.current.pageClass == 'settings') return false;
	$('#page_ajax').load(_mtt.mttUrl+'settings.php?ajax=yes',null,function(){ 
		//showhide($('#page_ajax').addClass('mtt-page-settings'), $('#page_tasks'));
		_mtt.pageSet('ajax','settings');
	})
	return false;
}

function saveSettings(frm)
{
	if(!frm) return false;
	var params = { save:'ajax' };
	$(frm).find("input:text,input:password,input:checked,select").filter(":enabled").each(function() { params[this.name || '__'] = this.value; }); 
	$(frm).find(":submit").attr('disabled','disabled').blur();
	$.post(_mtt.mttUrl+'settings.php', params, function(json){
		if(json.saved) {
			flashInfo(_mtt.lang.get('settingsSaved'));
			setTimeout('window.location.reload();', 1000);
		}
	}, 'json');
} 

function handleTaskListsButtonClicked()
{
    $("#mypanel").panel("toggle");
}

function handleEditTaskButtonClicked(el)
{
    var div = findParentNode(el, 'DIV');
    var taskId = div.id.split('_')[0];

    console.log('edit task button clicked, id=' + taskId);

    editTask(taskId);
}

function handleMoveTaskButtonClicked()
{
    $('#popupMenuMoveTask').popup('open', {transition:'pop'});
}

function handleSaveTaskButtonClicked()
{
    $('#taskedit_form').submit();
}

function convertFormat4DatePicker(dateInt) // 20130929
{
    var newDate = '';
    if (dateInt > 0) {
        var year = Math.floor(dateInt / 10000);
        var monthDay = Math.floor(dateInt % 10000);
        var month = Math.floor(monthDay / 100);
        var day = Math.floor(monthDay % 100);
        newDate = year + '-' + month + '-' + day;
    }
    return newDate;
}

function showMessageDialog(msg)
{
    $('#popupDialogMessage').html(msg);
    $('#popupDialog').popup('open', {transition:'pop'});
}

function onMoveToListClicked(el)
{
    var li = findParentNode(el, 'LI');
    var listId = li.id.split(':')[1];
    var taskId = _mtt.menus.cmenu.tag;

    console.log('move task to, task id=' + taskId + ', list id=' + listId);

    moveTaskToList(taskId, listId);

    $('#popupMenuMoveTask').popup('close');
}

})();
