package com.ensia.s3_hello_world.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3ClientBuilder;
import java.net.URI;

@Configuration
public class S3Config {
    @Value("${app.s3.endpoint}")
    private String endpoint;
    @Value("${app.s3.access-key}")
    private String accessKey;
    @Value("${app.s3.secret-key}")
    private String secretKey;
    @Value("${app.s3.region}")
    private String region;
    @Value("${app.s3.path-style-access:true}")
    private boolean pathStyleAccess;

    @Bean
    public S3Client s3Client() {
        S3ClientBuilder builder = S3Client.builder()
                .endpointOverride(URI.create(endpoint))
                .region(Region.of(region))
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(accessKey, secretKey)));
        
        // Enable path-style access for MinIO compatibility
        if (pathStyleAccess) {
            builder.forcePathStyle(true);
        }
        
        return builder.build();
    }
}
