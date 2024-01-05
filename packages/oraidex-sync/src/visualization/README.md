# How to run Metabase with Duckdb to visualize & create new SQL queries

## 1. Build metabase duckdb driver image

```bash
docker build . --tag metaduck:v0.48.1 -f visualization/Dockerfile
```

## 2. Start the container

```bash
# replace $PWD/db to the directory where you keep the duckdb database files
docker run -v $PWD/db:/container/directory --name metaduck -p 80:3000 -m 2GB -e MB_PLUGINS_DIR=/home/plugins metaduck:v0.48.1
```

## 3. Open the metabase browser through http://localhost & follow the steps of metabase
