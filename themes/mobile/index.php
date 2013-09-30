<?php header("Content-type: text/html; charset=utf-8"); ?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title><?php mttinfo('title'); ?></title>
<link rel="stylesheet" type="text/css" href="jquery/jquery.mobile-1.3.1.css" media="all" />
<link rel="stylesheet" type="text/css" href="<?php mttinfo('template_url'); ?>style.css?v=1.4.2" media="all" />
</head>

<body>

<script type="text/javascript" src="<?php mttinfo('mtt_url'); ?>jquery/jquery-1.10.2.js"></script>
<script type="text/javascript" src="<?php mttinfo('mtt_url'); ?>jquery/jquery.mobile-1.3.1.js"></script>
<script type="text/javascript" src="<?php mttinfo('mtt_url'); ?>jquery/jquery.autocomplete-1.1.js"></script>
<script type="text/javascript" src="<?php mttinfo('mtt_url'); ?>mytinytodo_mobile.js?v=1.4.2"></script>
<script type="text/javascript" src="<?php mttinfo('mtt_url'); ?>mytinytodo_lang.php?v=1.4.2"></script>
<script type="text/javascript" src="<?php mttinfo('mtt_url'); ?>mytinytodo_ajax_storage.js?v=1.4.2"></script>

<script type="text/javascript">
//DOM full loaded
$().ready(function(){

    $('body').width(screen.width);
    $(window).resize(function() {
        $('body').width(screen.width);
    });

    mytinytodo.mttUrl = "<?php mttinfo('mtt_url'); ?>";
    mytinytodo.templateUrl = "<?php mttinfo('template_url'); ?>";
    mytinytodo.db = new mytinytodoStorageAjax(mytinytodo);
    mytinytodo.init({
            needAuth: <?php echo $needAuth ? "true" : "false"; ?>,
            isLogged: <?php echo ($needAuth && is_logged()) ? "true" : "false"; ?>,
            showdate: <?php echo (Config::get('showdate') && !isset($_GET['pda'])) ? "true" : "false"; ?>,
            singletab: <?php echo (isset($_GET['singletab']) || isset($_GET['pda'])) ? "true" : "false"; ?>,
            duedatepickerformat: "<?php echo htmlspecialchars(Config::get('dateformat2')); ?>",
            firstdayofweek: <?php echo (int) Config::get('firstdayofweek'); ?>,
            autotag: <?php echo Config::get('autotag') ? "true" : "false"; ?>
            <?php if(isset($_GET['list'])) echo ",openList: ". (int)$_GET['list']; ?>
            <?php echo ", touchDevice: true"; ?>
    }).loadLists(1);
});
</script>

<!--START PAGEs-->
<div id="page_tasks"><!-- data-role="page"-->
    <div data-role="panel" id="mypanel" data-position="left" data-display="overlay">
        <div id="lists">
         <ul class="mtt-tabs" data-role="listview" data-count-theme="c" data-inset="true"></ul>
        </div>
        <div id="settings_bar" align="right" data-role="controlgroup" data-corners="false" data-type="horizontal">
           <a id="settings_bar_login" href="#popupLogin" data-icon="grid" data-role="button" data-rel="popup" data-position-to="window"data-transition="pop" data-inline="true" data-mini="true">Login</a>
           <a id="settings_bar_logout" href="#" data-icon="grid" data-role="button" data-position-to="window" data-inline="true" data-mini="true">Logout</a>
           <a id="settings_bar_system_setting" href="#" data-icon="gear" data-role="button" data-inline="true" data-mini="true">Settings</a>
        </div>
    </div>
    <div data-role="header">
       <a id="header_btn_task_lists" href="#" data-icon="bars" data-role="button">Lists</a>
       <h1 id="header_title_tasks"><?php mttinfo('title'); ?></h1>
       <a id="header_btn_add_task" data-icon="plus" data-role="button">Add</a> <!--href="#page_taskedit" -->
    </div>
    <div data-role="content">
        <div id="tasklist" data-role="collapsible-set" data-theme="c" data-content-theme="d" data-collapsed-icon="arrow-r" data-expanded-icon="arrow-d">
        </div>
    </div>
    <div data-role="footer">
    </div>
</div>

<div id="page_taskedit" style="display:none"> <!-- data-role="page"-->
    <div data-role="header">
       <a id="header_btn_edit_task_back" href="#" data-icon="bars" data-role="button">Back</a> <!--data-rel="back" -->
       <h1 id="header_title_edit_task"><?php mttinfo('title'); ?></h1>
       <a id="header_btn_edit_task_save" href="#" data-icon="edit" data-role="button">Save</a>
    </div>
    <div data-role="content">
        <form id="taskedit_form" name="edittask" method="post">
            <input type="hidden" name="isadd" value="0" />
            <input type="hidden" name="id" value="" />

            <label for="task">Title:</label>
            <input type="text" name="task" id="task" value="">

            <label for="note">Note:</label>
            <textarea cols="40" rows="5" name="note" id="note"></textarea>

            <label for="prio" class="select">Priority:</label>
            <select name="prio" id="prio" data-native-menu="false">
                <option value="">Task Priority</option>
                <option value="2">+2</option>
                <option value="1">+1</option>
                <option value="0">±0</option>
                <option value="-1">-1</option>
            </select>

            <label for="duedate">Due:</label>
            <input type="date" name="duedate" id="duedate" value="">

            <label for="tags">Tags:</label>
            <input type="text" name="tags" id="tags" value="">

        </form>
    </div>
    <div data-role="footer">
    </div>
</div>
<!--END PAGEs-->

<!--START POPUPs-->
<div data-role="popup" id="popupLogin" data-overlay-theme="a" class="ui-corner-all">
    <form id="login_form">
        <div style="padding:10px 20px;">
            <label for="password" class="ui-hidden-accessible">Password:</label>
            <input type="password" name="password" id="password" value="" placeholder="password">
            <button type="submit" data-icon="check">Login</button>
        </div>
    </form>
</div>

<div data-role="popup" id="popupDialog" class="ui-content" style="max-width:280px">
    <a href="#" data-rel="back" data-role="button" data-theme="a" data-icon="delete" data-iconpos="notext" class="ui-btn-right">Close</a>
    <p id="popupDialogMessage"></p>
</div>
<!--END POPUPs-->

</body>
</html>
