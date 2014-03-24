#sudo apt-get update
#sudo apt-get -y install postgresql postgresql-contrib

#Switch to postgres user
#su - postgres
#Create database
#createdb bitbox
#Create tables
USERNAME=alexander
FILENAME=templateFile.psql
psql -U ${USERNAME} -d bitbox -a -f ${FILENAME}
