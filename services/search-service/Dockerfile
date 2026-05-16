FROM eclipse-temurin:17-jre
WORKDIR /app
COPY target/search-service-0.0.1-SNAPSHOT.jar app.jar
EXPOSE 8087
ENTRYPOINT ["java","-jar","/app/app.jar"]
