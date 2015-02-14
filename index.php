<?php
/*
	This file is part of myTinyTodo.
	(C) Copyright 2009-2010 Max Pozdeev <maxpozdeev@gmail.com>
	Licensed under the GNU GPL v2 license. See file COPYRIGHT for details.
*/

require_once('./init.php');

$lang = Lang::instance();

if($lang->rtl()) Config::set('rtl', 1);

if(!is_int(Config::get('firstdayofweek')) || Config::get('firstdayofweek')<0 || Config::get('firstdayofweek')>6) Config::set('firstdayofweek', 1);

$_SESSION['template'] = 'default';

require_once "lib/Mobile_Detect.php";
$mobile = new Mobile_Detect();

if ($mobile->isMobile() || $mobile->isTablet()) {
    $_SESSION['template'] = 'mobile';
}

//define('TEMPLATEPATH', MTTPATH. 'themes/'.Config::get('template').'/');

require(MTTPATH. 'themes/'. $_SESSION['template']. '/index.php');

?>
