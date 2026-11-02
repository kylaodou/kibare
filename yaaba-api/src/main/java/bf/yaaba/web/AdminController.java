package bf.yaaba.web;

import bf.yaaba.domain.Comment;
import bf.yaaba.service.CommentService;
import bf.yaaba.service.ContributionService;
import bf.yaaba.service.DashboardService;
import bf.yaaba.service.TaleService;
import bf.yaaba.web.Dto.AudioView;
import bf.yaaba.web.Dto.CommentView;
import bf.yaaba.web.Dto.ContributionView;
import bf.yaaba.web.Dto.DashboardView;
import bf.yaaba.web.Dto.MediaView;
import bf.yaaba.web.Dto.PageView;
import bf.yaaba.web.Dto.ReviewRequest;
import bf.yaaba.web.Dto.StatsView;
import bf.yaaba.web.Dto.UserView;
import com.fasterxml.jackson.databind.JsonNode;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/admin")
@Tag(name = "Administration", description = "Réservé au rôle ADMIN")
@SecurityRequirement(name = "bearer")
public class AdminController {

    private final ContributionService contributions;
    private final TaleService tales;
    private final CommentService comments;
    private final DashboardService dashboard;

    public AdminController(ContributionService contributions, TaleService tales, CommentService comments, DashboardService dashboard) {
        this.contributions = contributions;
        this.tales = tales;
        this.comments = comments;
        this.dashboard = dashboard;
    }

    @GetMapping("/stats")
    public StatsView stats() {
        return tales.stats();
    }

    @GetMapping("/dashboard")
    @Operation(summary = "Indicateurs, activité des 30 derniers jours et dernières actions")
    public DashboardView dashboard() {
        return dashboard.dashboard();
    }

    /* ---------------------------------------------------- contributions */

    @GetMapping("/contributions")
    @Operation(summary = "Contributions paginées : statut (PENDING, APPROVED, REJECTED, ALL), recherche, tri « champ,asc|desc »")
    public PageView<ContributionView> list(@RequestParam(defaultValue = "ALL") String status, @RequestParam(defaultValue = "") String q,
                                           @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "10") int size,
                                           @RequestParam(required = false) String sort) {
        return contributions.page(status, q, page, size, sort);
    }

    @PostMapping("/contributions/{id}/approve")
    @Operation(summary = "Accepter : publie la voix ou le nouveau conte et prévient l'auteur")
    public ContributionView approve(@PathVariable long id, @RequestBody(required = false) ReviewRequest body) {
        return contributions.approve(id, body == null ? null : body.note());
    }

    @PostMapping("/contributions/{id}/reject")
    public ContributionView reject(@PathVariable long id, @RequestBody(required = false) ReviewRequest body) {
        return contributions.reject(id, body == null ? null : body.note());
    }

    @DeleteMapping("/contributions/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable long id) {
        contributions.delete(id);
    }

    /* ------------------------------------------------------------ contes */

    @GetMapping("/tales")
    @Operation(summary = "Contes paginés (recherche, origine, tri ; du plus récent au plus ancien par défaut)")
    public PageView<Map<String, Object>> tales(@RequestParam(defaultValue = "") String q, @RequestParam(defaultValue = "") String origin,
                                               @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "10") int size,
                                               @RequestParam(required = false) String sort) {
        return tales.adminPage(q, origin, page, size, sort);
    }

    @GetMapping("/tales/{slug}")
    public JsonNode tale(@PathVariable String slug) {
        return tales.adminGet(slug);
    }

    @PostMapping("/tales")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Créer un conte depuis l'éditeur (JSON complet)")
    public JsonNode create(@RequestBody JsonNode body) {
        return tales.save(null, body);
    }

    @PutMapping("/tales/{slug}")
    public JsonNode update(@PathVariable String slug, @RequestBody JsonNode body) {
        return tales.save(slug, body);
    }

    @PatchMapping("/tales/{slug}/published")
    public void publish(@PathVariable String slug, @RequestParam boolean value) {
        tales.setPublished(slug, value);
    }

    @DeleteMapping("/tales/{slug}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteTale(@PathVariable String slug) {
        tales.delete(slug);
    }

    @PostMapping(value = "/tales/{slug}/audio", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Ajouter une voix à un paragraphe (sceneId) du conte")
    public AudioView addAudio(@PathVariable String slug, @RequestParam String lang, @RequestParam String narrator,
                              @RequestParam(required = false) String sceneId, @RequestPart("audio") MultipartFile audio) {
        return tales.addAudio(slug, sceneId, lang, narrator, audio);
    }

    @PostMapping(value = "/media/video", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Téléverser la vidéo d'un paragraphe (mp4, webm, ogv ; 10 Mo maximum)")
    public MediaView uploadVideo(@RequestPart("video") MultipartFile video) {
        return tales.uploadVideo(video);
    }

    @DeleteMapping("/audio/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAudio(@PathVariable long id) {
        tales.deleteAudio(id);
    }

    /* ------------------------------------------------------ commentaires */

    @GetMapping("/comments")
    public PageView<CommentView> comments(@RequestParam(defaultValue = "ALL") String status, @RequestParam(defaultValue = "") String q,
                                          @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "10") int size,
                                          @RequestParam(required = false) String sort) {
        return comments.page(status, q, page, size, sort);
    }

    @PatchMapping("/comments/{id}")
    public CommentView moderate(@PathVariable long id, @RequestParam String status) {
        return comments.setStatus(id, Comment.Status.valueOf(status));
    }

    /* ------------------------------------------------------ utilisateurs */

    @GetMapping("/users")
    public PageView<Map<String, Object>> users(@RequestParam(defaultValue = "") String q, @RequestParam(defaultValue = "0") int page,
                                               @RequestParam(defaultValue = "10") int size, @RequestParam(required = false) String sort) {
        return dashboard.usersPage(q, page, size, sort);
    }

    @PatchMapping("/users/{id}")
    public UserView updateUser(@PathVariable long id, @RequestParam(required = false) Boolean active,
                               @RequestParam(required = false) String role) {
        return dashboard.updateUser(id, active, role);
    }
}
