FROM eclipse-temurin:17-jre
WORKDIR /app
COPY target/audit-service-0.0.1-SNAPSHOT.jar app.jar
EXPOSE 8086
ENTRYPOINT ["java","-jar","/app/app.jar"]
