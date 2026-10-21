<?php
$values = ['BASE_URL'=>getenv('EA_BASE_URL'), 'LANGUAGE'=>'english','DEBUG_MODE'=>false,'DB_HOST'=>'db','DB_NAME'=>'easyappointments','DB_USERNAME'=>'easylayer','DB_PASSWORD'=>getenv('EA_DB_PASSWORD')];
foreach (['BASE_URL','DB_PASSWORD'] as $key) { if (!$values[$key]) throw new RuntimeException("Missing $key"); }
$code="<?php\nclass Config {\n";
foreach($values as $key=>$value) $code.='const '.$key.' = '.var_export($value,true).";\n";
file_put_contents('/var/www/html/config.php',$code."}\n");
chown('/var/www/html/config.php','www-data'); chmod('/var/www/html/config.php',0600);
