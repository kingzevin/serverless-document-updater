all: update

update: 
	./rezip.sh document-updater
	wsk -i action update /guest/sharelatex/document-updater document-updater.zip --kind  nodejs:10 --web raw


