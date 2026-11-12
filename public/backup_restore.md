#backup cantina_casinha_aul local
mongodump \
  --host="192.168.219.155" \
  --port=27017 \
  --username="cantina-db-user" \
  --password="password123"
  --authenticationDatabase="cantina_casinha_Azul" \
  --db="cantina_casinha_Azul" \
  --archive="cantina_casinha_Azul.archive.gz" \
  --gzip
  
mongorestore \
  --uri="mongodb+srv://casinhaazulclr.46cdvel.mongodb.net/?authSource=admin" \
  --username="casinhaazul_db_user" \
  --password="5K7xAP5cI4RJUGLX" \
  --archive="./cantina_casinha_Azul.archive.gz" \
  --gzip \
  --nsInclude="cantina_casinha_Azul.*" \
  --drop \
  --stopOnError \
  --verbose

mongorestore \
  --uri="mongodb+srv://casinhaazulclr.46cdvel.mongodb.net/?authSource=admin" \
  --username="casinhaazul_db_user" \
  --archive="./cantina_casinha_Azul.archive.gz" \
  --gzip \
  --nsInclude="cantina_casinha_Azul.*" \
  --drop \
  --stopOnError \
  --verbose