package com.ensia.auth_service;

import static org.assertj.core.api.Assertions.assertThat;

import com.ensia.auth_service.user.UserAccount;
import com.ensia.auth_service.user.UserAccountRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK, properties = {
        "spring.datasource.url=jdbc:h2:mem:authdb;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.auth.jwt-secret=change-this-for-production-and-use-a-strong-key-please-1234567890"
})
@AutoConfigureMockMvc
class AuthServiceApplicationTests {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    private UserAccountRepository userAccountRepository;
    @Autowired
    private MockMvc mockMvc;

    @Test
    void loginReturnsTokenAndUpdatesLastLogin() throws Exception {
        String responseBody = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"admin123\"}"))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        assertThat(responseBody).contains("\"token\"");

        UserAccount account = userAccountRepository.findByUsernameIgnoreCase("admin").orElseThrow();
        assertThat(account.getLastLoginAt()).isNotNull();
    }

    @Test
    void loginWithWrongPasswordReturns401() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"wrong-password\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void registerCreatesUserAndLogoutTracksTimestamp() throws Exception {
        String email = "new-user-" + UUID.randomUUID() + "@ensia.dz";
        String registerBody = String.format("{\"email\":\"%s\",\"password\":\"new-user-123\",\"roles\":[\"USER\"]}", email);

        String registerResponse = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerBody))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonNode registerJson = objectMapper.readTree(registerResponse);
        assertThat(registerJson.get("email").asText()).isEqualTo(email.toLowerCase());

        String username = email.substring(0, email.indexOf('@'));
        assertThat(userAccountRepository.findByUsernameIgnoreCase(username)).isPresent();

        String loginBody = String.format("{\"email\":\"%s\",\"password\":\"new-user-123\"}", email);
        String loginResponse = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginBody))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String jwt = objectMapper.readTree(loginResponse).get("token").asText();

        mockMvc.perform(post("/api/auth/logout")
                        .header("Authorization", "Bearer " + jwt))
                .andExpect(status().isOk());

        UserAccount loggedOut = userAccountRepository.findByUsernameIgnoreCase(username).orElseThrow();
        assertThat(loggedOut.getLastLogoutAt()).isNotNull();
    }
}
