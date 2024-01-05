# metabase duckdb driver dockerfile for visualization
FROM openjdk:19-buster

ENV MB_PLUGINS_DIR=/home/plugins/

ADD https://downloads.metabase.com/v0.48.1/metabase.jar /home
ADD https://github.com/AlexR2D2/metabase_duckdb_driver/releases/download/0.2.3/duckdb.metabase-driver.jar /home/plugins/

RUN chmod 744 /home/plugins/duckdb.metabase-driver.jar

CMD ["java", "-jar", "/home/metabase.jar"]