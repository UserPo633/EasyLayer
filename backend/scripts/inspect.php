<?php
require '/var/www/html/config.php';
$d=new PDO('mysql:host=db;dbname=easyappointments;charset=utf8mb4',Config::DB_USERNAME,Config::DB_PASSWORD,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$services=$d->query('SELECT id,name,price,currency FROM ea_services ORDER BY id')->fetchAll(PDO::FETCH_ASSOC);
$bookings=$d->query('SELECT id,start_datetime,end_datetime,id_services,id_users_provider FROM ea_appointments WHERE is_unavailability=0 ORDER BY id')->fetchAll(PDO::FETCH_ASSOC);
echo json_encode(['services'=>$services,'bookings'=>$bookings],JSON_PRETTY_PRINT);
