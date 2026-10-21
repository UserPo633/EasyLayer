<?php
require '/var/www/html/config.php';
$d=new PDO('mysql:host=db;dbname=easyappointments;charset=utf8mb4',Config::DB_USERNAME,Config::DB_PASSWORD,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$d->beginTransaction();
// Test-environment data configuration only. No source templates or controllers changed.
$d->exec("UPDATE ea_settings SET value='0' WHERE name IN ('customer_notifications','require_captcha')");
$d->exec("UPDATE ea_user_settings SET notifications=0, google_sync=0");
$template=$d->query('SELECT * FROM ea_services ORDER BY id LIMIT 1')->fetch(PDO::FETCH_ASSOC);
if(!$template) throw new RuntimeException('Complete native installation first');
$provider=(int)$d->query('SELECT id_users FROM ea_services_providers ORDER BY id_users LIMIT 1')->fetchColumn();
if(!$provider)throw new RuntimeException('Missing default provider');
$names=['Photography Introduction','Photo Editing','Smartphone Basics','Craft Workshop','Gardening Basics','Language Conversation'];
foreach($names as $i=>$name){
 $q=$d->prepare('SELECT id FROM ea_services WHERE name=?');$q->execute([$name]);$id=$q->fetchColumn();
 if(!$id){
  $row=$template;unset($row['id']);$row['name']=$name;$row['duration']=30;$row['price']=[10,15,0,12,8,0][$i];$row['currency']='USD';
  $cols=array_keys($row);$sql='INSERT INTO ea_services (`'.implode('`,`',$cols).'`) VALUES ('.implode(',',array_fill(0,count($cols),'?')).')';
  $d->prepare($sql)->execute(array_values($row));$id=$d->lastInsertId();
 }
 $d->prepare('INSERT IGNORE INTO ea_services_providers (id_users,id_services) VALUES (?,?)')->execute([$provider,$id]);
}
$d->commit();echo "Seeded six services; notifications off; original default provider retained.\n";
