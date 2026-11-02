package bf.yaaba.web;

import bf.yaaba.service.AuthService;
import bf.yaaba.service.GoogleAuthService;
import bf.yaaba.service.ContributionService;
import bf.yaaba.service.NotificationService;
import bf.yaaba.service.PasswordResetService;
import bf.yaaba.web.Dto.AuthView;
import bf.yaaba.web.Dto.ContributionView;
import bf.yaaba.web.Dto.ForgotRequest;
import bf.yaaba.web.Dto.PasswordChangeRequest;
import bf.yaaba.web.Dto.GoogleConfigView;
import bf.yaaba.web.Dto.GoogleRequest;
import bf.yaaba.web.Dto.MessageView;
import bf.yaaba.web.Dto.ResetRequest;
import bf.yaaba.web.Dto.ResetTokenView;
import bf.yaaba.web.Dto.TokenRequest;
import bf.yaaba.web.Dto.VerifyCodeRequest;
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
    private final PasswordResetService resets;
    private final GoogleAuthService google;

    public AccountController(AuthService auth, ContributionService contributions, NotificationService notifications,
                             PasswordResetService resets, GoogleAuthService google) {
        this.google = google;
        this.auth = auth;
        this.contributions = contributions;
        this.notifications = notifications;
        this.resets = resets;
    }

    /* ------------------------------------------------ connexion Google */

    @GetMapping("/api/auth/google/config")
    @Operation(summary = "Connexion Google disponible ? (identifiant client public)")
    public GoogleConfigView googleConfig() {
        return google.config();
    }

    @PostMapping("/api/auth/google")
    @Operation(summary = "Connexion ou inscription avec un jeton d'identité Google (Google Identity Services)")
    public AuthView google(@Valid @RequestBody GoogleRequest req) {
        return google.signIn(req.credential());
    }

    /* ------------------------------------------------ vérification e-mail */

    @PostMapping("/api/auth/verify-email")
    @Operation(summary = "Confirmer l'adresse e-mail avec le jeton reçu par e-mail")
    public UserView verifyEmail(@Valid @RequestBody TokenRequest req) {
        return auth.verifyEmail(req.token());
    }

    @PostMapping("/api/me/verify-email/resend")
    @Operation(summary = "Renvoyer le lien de confirmation")
    public MessageView resendVerification() {
        auth.resendVerification();
        return new MessageView("Un nouveau lien de confirmation vous a été envoyé.");
    }

    /* ------------------------------------------- mot de passe oublié */

    @PostMapping("/api/auth/password/forgot")
    @Operation(summary = "Étape 1 : envoyer un code à 6 chiffres (valable 5 minutes) si le compte existe")
    public MessageView forgot(@Valid @RequestBody ForgotRequest req) {
        resets.request(req.email());
        return new MessageView("Si un compte correspond à cette adresse, un code vient de vous être envoyé. Il est valable 5 minutes.");
    }

    @PostMapping("/api/auth/password/verify")
    @Operation(summary = "Étape 2 : vérifier le code ; renvoie un jeton de réinitialisation")
    public ResetTokenView verifyCode(@Valid @RequestBody VerifyCodeRequest req) {
        return resets.verify(req.email(), req.code());
    }

    @PostMapping("/api/auth/password/reset")
    @Operation(summary = "Étape 3 : enregistrer le nouveau mot de passe")
    public MessageView reset(@Valid @RequestBody ResetRequest req) {
        resets.reset(req.resetToken(), req.password());
        return new MessageView("Votre mot de passe a été modifié. Vous pouvez vous connecter.");
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

    @PutMapping("/api/me/password")
    @SecurityRequirement(name = "bearer")
    @Operation(summary = "Définir (compte Google) ou changer son mot de passe")
    public UserView changePassword(@Valid @RequestBody PasswordChangeRequest req) {
        return auth.changePassword(req.currentPassword(), req.newPassword());
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
