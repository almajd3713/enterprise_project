FROM eclipse-temurin:21-jre-jammy
WORKDIR /app
# Maven puts the jar in 'target', Gradle puts it in 'build/libs'
COPY target/documents-service-0.0.1-SNAPSHOT.jar app.jar
EXPOSE 8081
ENTRYPOINT ["java","-jar","app.jar"]