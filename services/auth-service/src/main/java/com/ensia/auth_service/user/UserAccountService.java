package com.ensia.auth_service.user;

import com.ensia.auth_service.auth.AuthProperties;
import jakarta.annotation.PostConstruct;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserAccountService {

    private final UserAccountRepository repository;
    private final DepartmentRepository departmentRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthProperties authProperties;

    public UserAccountService(UserAccountRepository repository,
                              DepartmentRepository departmentRepository,
                              PasswordEncoder passwordEncoder,
                              AuthProperties authProperties) {
        this.repository = repository;
        this.departmentRepository = departmentRepository;
        this.passwordEncoder = passwordEncoder;
        this.authProperties = authProperties;
    }

    @PostConstruct
    @Transactional
    public void seedUsersIfMissing() {
        for (AuthProperties.UserEntry userEntry : authProperties.getUsers()) {
            if (userEntry.getUsername() == null || userEntry.getPassword() == null || userEntry.getEmail() == null) {
                continue;
            }

            String username = userEntry.getUsername().trim();
            String email = userEntry.getEmail().trim().toLowerCase(Locale.ROOT);
            if (repository.existsByUsernameIgnoreCase(username) || repository.existsByEmailIgnoreCase(email)) {
                continue;
            }

            UserAccount account = new UserAccount();
            account.setUsername(username);
            account.setEmail(email);
            account.setPasswordHash(passwordEncoder.encode(userEntry.getPassword()));
            account.setSalt(UUID.randomUUID().toString().replace("-", ""));
            account.setRoles(parseRoles(userEntry.getRoles(), null));
            account.setDepartmentIds(defaultDepartmentsForSeedUser(username));
            account.setActive(true);
            repository.save(account);
        }
    }

    @Transactional(readOnly = true)
    public UserAccount getByUsername(String username) {
        return repository.findByUsernameIgnoreCase(username)
                .or(() -> repository.findByEmailIgnoreCase(username))
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
    }

    @Transactional(readOnly = true)
    public List<UserResponse> list(String query, String role, String active) {
        String normalizedQuery = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        String normalizedRole = role == null ? "all" : role.trim().toLowerCase(Locale.ROOT);
        String normalizedActive = active == null ? "all" : active.trim().toLowerCase(Locale.ROOT);

        return repository.findAll().stream()
                .filter(user -> normalizedQuery.isBlank()
                        || user.getUsername().toLowerCase(Locale.ROOT).contains(normalizedQuery)
                        || user.getEmail().toLowerCase(Locale.ROOT).contains(normalizedQuery))
                .filter(user -> "all".equals(normalizedRole)
                        || user.getRoles().stream().map(Enum::name).map(String::toLowerCase).anyMatch(normalizedRole::equals))
                .filter(user -> "all".equals(normalizedActive)
                        || ("active".equals(normalizedActive) && user.isActive())
                        || ("disabled".equals(normalizedActive) && !user.isActive()))
                .map(UserResponse::from)
                .toList();
    }

    @Transactional
    public UserResponse create(CreateUserRequest request) {
        validateCreateRequest(request);

        String username = request.getUsername() == null || request.getUsername().isBlank()
                ? deriveUsernameFromEmail(request.getEmail())
                : request.getUsername().trim();
        String email = request.getEmail().trim().toLowerCase(Locale.ROOT);

        if (repository.existsByUsernameIgnoreCase(username)) {
            throw new IllegalArgumentException("Username already exists");
        }
        if (repository.existsByEmailIgnoreCase(email)) {
            throw new IllegalArgumentException("Email already exists");
        }

        UserAccount account = new UserAccount();
        account.setUsername(username);
        account.setEmail(email);
        account.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        account.setSalt(UUID.randomUUID().toString().replace("-", ""));
        account.setRoles(parseRoles(request.getRoles(), request.getRole()));
        account.setActive(true);

        return UserResponse.from(repository.save(account));
    }

    @Transactional
    public UserResponse updateRole(Long userId, UpdateUserRoleRequest request) {
        UserAccount account = findById(userId);
        account.setRoles(parseRoles(request.getRoles(), request.getRole()));
        return UserResponse.from(repository.save(account));
    }

    @Transactional
    public UserResponse updateState(Long userId, boolean active) {
        UserAccount account = findById(userId);
        account.setActive(active);
        if (!active) {
            account.setLastLogoutAt(Instant.now());
        }
        return UserResponse.from(repository.save(account));
    }

    @Transactional
    public UserResponse updateDepartments(Long userId, List<Long> departmentIds) {
        UserAccount account = findById(userId);
        LinkedHashSet<Long> requested = (departmentIds == null ? List.<Long>of() : departmentIds).stream()
                .filter(Objects::nonNull)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));

        if (!requested.isEmpty()) {
            Set<Long> existing = departmentRepository.findAllById(requested).stream()
                    .map(Department::getId)
                    .collect(java.util.stream.Collectors.toSet());
            if (existing.size() != requested.size()) {
                throw new IllegalArgumentException("One or more departments were not found");
            }
        }

        account.setDepartmentIds(requested);
        return UserResponse.from(repository.save(account));
    }

    @Transactional
    public void resetPassword(Long userId, String newPassword) {
        if (newPassword == null || newPassword.length() < 8) {
            throw new IllegalArgumentException("newPassword must be at least 8 characters");
        }
        UserAccount account = findById(userId);
        account.setPasswordHash(passwordEncoder.encode(newPassword));
        repository.save(account);
    }

    @Transactional
    public void changePassword(String username, String currentPassword, String newPassword) {
        if (newPassword == null || newPassword.length() < 8) {
            throw new IllegalArgumentException("newPassword must be at least 8 characters");
        }

        UserAccount account = getByUsername(username);
        if (!passwordEncoder.matches(currentPassword, account.getPasswordHash())) {
            throw new IllegalArgumentException("Current password is invalid");
        }

        account.setPasswordHash(passwordEncoder.encode(newPassword));
        repository.save(account);
    }

    @Transactional
    public void markLogin(String username) {
        repository.findByUsernameIgnoreCase(username).ifPresent(account -> {
            account.setLastLoginAt(Instant.now());
            repository.save(account);
        });
    }

    @Transactional
    public void markLogout(String username) {
        repository.findByUsernameIgnoreCase(username).ifPresent(account -> {
            account.setLastLogoutAt(Instant.now());
            repository.save(account);
        });
    }

    @Transactional(readOnly = true)
    public List<DepartmentResponse> listDepartments() {
        return departmentRepository.findAll()
                .stream()
                .map(DepartmentResponse::from)
                .toList();
    }

    @Transactional
    public DepartmentResponse createDepartment(CreateDepartmentRequest request) {
        if (request == null || request.getName() == null || request.getName().isBlank()) {
            throw new IllegalArgumentException("department name is required");
        }

        String name = request.getName().trim();
        if (departmentRepository.existsByNameIgnoreCase(name)) {
            throw new IllegalArgumentException("Department already exists");
        }

        Department department = new Department();
        department.setName(name);
        return DepartmentResponse.from(departmentRepository.save(department));
    }

    @Transactional
    public DepartmentResponse updateDepartment(Long departmentId, CreateDepartmentRequest request) {
        if (request == null || request.getName() == null || request.getName().isBlank()) {
            throw new IllegalArgumentException("department name is required");
        }
        Department department = departmentRepository.findById(departmentId)
                .orElseThrow(() -> new IllegalArgumentException("Department not found"));
        String name = request.getName().trim();
        if (departmentRepository.existsByNameIgnoreCase(name)
                && !name.equalsIgnoreCase(department.getName())) {
            throw new IllegalArgumentException("Department already exists");
        }
        department.setName(name);
        return DepartmentResponse.from(departmentRepository.save(department));
    }

    @Transactional
    public void deleteDepartment(Long departmentId) {
        Department department = departmentRepository.findById(departmentId)
                .orElseThrow(() -> new IllegalArgumentException("Department not found"));
        departmentRepository.delete(department);
    }

    private void validateCreateRequest(CreateUserRequest request) {
        if (request.getEmail() == null || request.getEmail().isBlank()) {
            throw new IllegalArgumentException("email is required");
        }
        if (request.getPassword() == null || request.getPassword().length() < 8) {
            throw new IllegalArgumentException("password must be at least 8 characters");
        }
        if ((request.getRoles() == null || request.getRoles().isEmpty())
                && (request.getRole() == null || request.getRole().isBlank())) {
            throw new IllegalArgumentException("at least one role is required");
        }
    }

    private Set<UserRole> parseRoles(List<String> roles, String role) {
        LinkedHashSet<UserRole> normalized = new LinkedHashSet<>();

        if (roles != null) {
            for (String entry : roles) {
                if (entry == null || entry.isBlank()) {
                    continue;
                }
                normalized.add(parseRole(entry));
            }
        }

        if (role != null && !role.isBlank()) {
            normalized.add(parseRole(role));
        }

        if (normalized.isEmpty()) {
            normalized.add(UserRole.USER);
        }

        if (normalized.contains(UserRole.ADMIN)) {
            normalized.add(UserRole.USER);
        }

        return normalized;
    }

    private UserRole parseRole(String role) {
        try {
            return UserRole.valueOf(role.trim().toUpperCase(Locale.ROOT));
        } catch (Exception ex) {
            throw new IllegalArgumentException("role must be ADMIN, OPERATOR, ANALYST, or USER");
        }
    }

    private String deriveUsernameFromEmail(String email) {
        int index = email.indexOf('@');
        String base = index > 0 ? email.substring(0, index) : email;
        String normalized = base.trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9._-]", "");
        if (normalized.isBlank()) {
            throw new IllegalArgumentException("email must contain a usable local part");
        }
        return normalized;
    }

    private UserAccount findById(Long userId) {
        return repository.findById(userId).orElseThrow(() -> new IllegalArgumentException("User not found"));
    }

    private Set<Long> defaultDepartmentsForSeedUser(String username) {
        if ("admin".equalsIgnoreCase(username)) {
            return new LinkedHashSet<>(List.of(1L, 2L, 3L, 4L, 5L));
        }
        if ("user".equalsIgnoreCase(username)) {
            return new LinkedHashSet<>(List.of(1L, 2L));
        }
        return new LinkedHashSet<>();
    }
}
