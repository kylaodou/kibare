package bf.yaaba.web;

import bf.yaaba.service.AuthService;
import bf.yaaba.service.ContributionService;
import bf.yaaba.service.NotificationService;
import bf.yaaba.web.Dto.AuthView;
import bf.yaaba.web.Dto.ContributionView;
import bf.yaaba.web.Dto.LoginRequest;
import bf.yaaba.web.Dto.NotificationView;
import bf.yaaba.web.Dto.ProfileRequest;
import bf.yaaba.web.Dto.RegisterRequest;
import bf.yaaba.web.Dto.UserView;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Tag(name = "Compte", description = "Inscription, connexion, profil, contributions et notifications")
public class AccountController {

    private final AuthService auth;
    private final ContributionService contributions;
    private final NotificationService notifications;

    public AccountController(AuthService auth, ContributionService contributions, NotificationService notifications) {
        this.auth = auth;
        this.contributions = contributions;
        this.notifications = notifications;
    }

    @PostMapping("/api/auth/register")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Créer un compte contributeur")
    public AuthView register(@Valid @RequestBody RegisterRequest req) {
        return auth.register(req);
    }

    @PostMapping("/api/auth/login")
    @Operation(summary = "Se connecter (renvoie un jeton JWT)")
    public AuthView login(@Valid @RequestBody LoginRequest req) {
        return auth.login(req);
    }

    @GetMapping("/api/me")
    @SecurityRequirement(name = "bearer")
    public UserView me() {
        return UserView.of(auth.current());
    }

    @PutMapping("/api/me")
    @SecurityRequirement(name = "bearer")
    public UserView updateMe(@Valid @RequestBody ProfileRequest req) {
        return auth.updateProfile(req);
    }

    @GetMapping("/api/me/contributions")
    @SecurityRequirement(name = "bearer")
    public List<ContributionView> myContributions() {
        return contributions.mine();
    }

    @GetMapping("/api/me/notifications")
    @SecurityRequirement(name = "bearer")
    public List<NotificationView> myNotifications() {
        return notifications.list(auth.current().getId(), auth.isAdmin());
    }

    @PostMapping("/api/me/notifications/read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @SecurityRequirement(name = "bearer")
    public void readAll() {
        notifications.markRead(auth.current().getId(), auth.isAdmin(), null);
    }

    @PostMapping("/api/me/notifications/{id}/read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @SecurityRequirement(name = "bearer")
    public void readOne(@PathVariable long id) {
        notifications.markRead(auth.current().getId(), auth.isAdmin(), id);
    }
}
