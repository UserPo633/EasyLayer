FROM php:8.3-apache-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends unzip libcurl4-openssl-dev libonig-dev libxml2-dev libpng-dev libjpeg62-turbo-dev libfreetype6-dev \
 && docker-php-ext-configure gd --with-freetype --with-jpeg \
 && docker-php-ext-install -j2 mysqli pdo_mysql mbstring curl gd simplexml \
 && a2enmod rewrite && rm -rf /var/lib/apt/lists/*
COPY upstream.zip /tmp/upstream.zip
RUN echo '299f8da75583ea185992ece4ac0b10e98f673825edbf75116446d99001911e60  /tmp/upstream.zip' | sha256sum -c - \
 && unzip -q /tmp/upstream.zip -d /var/www/html && rm /tmp/upstream.zip \
 && chown -R www-data:www-data /var/www/html/storage
COPY scripts/configure.php scripts/seed.php scripts/inspect.php /opt/easylayer/
COPY scripts/entrypoint.sh /usr/local/bin/easylayer-entrypoint
RUN chmod +x /usr/local/bin/easylayer-entrypoint
ENTRYPOINT ["easylayer-entrypoint"]
CMD ["apache2-foreground"]

# EasyLayer interaction prototype; original upstream business logic unchanged.
COPY ui/ /var/www/html/easylayer-demo/
