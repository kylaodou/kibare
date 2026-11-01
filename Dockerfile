# Image unique : front Angular + API Spring Boot sur le même port.
# docker build -t kibare . && docker run -p 8080:8080 kibare

FROM node:20-alpine AS web
WORKDIR /app
COPY content ./content
COPY yaaba-web/package*.json ./yaaba-web/
RUN cd yaaba-web && npm ci
COPY yaaba-web ./yaaba-web
RUN mkdir -p yaaba-api/src/main/resources && node content/build.mjs && cd yaaba-web && npx ng build

FROM maven:3.9-eclipse-temurin-21 AS api
WORKDIR /app
COPY yaaba-api/pom.xml ./
RUN mvn -q dependency:go-offline
COPY yaaba-api/src ./src
COPY --from=web /app/yaaba-web/dist/yaaba-web/browser ./src/main/resources/static
COPY --from=web /app/yaaba-api/src/main/resources/seed ./src/main/resources/seed
RUN mvn -q -DskipTests package

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=api /app/target/yaaba-api-1.0.0.jar app.jar
ENV PORT=8080 STORAGE_DIR=/data/uploads DATABASE_URL=jdbc:h2:file:/data/kibare
VOLUME /data
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
