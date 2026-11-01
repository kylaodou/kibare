package bf.yaaba.web;

import bf.yaaba.domain.Reference;
import bf.yaaba.service.CommentService;
import bf.yaaba.service.ContributionService;
import bf.yaaba.service.StorageService;
import bf.yaaba.service.TaleService;
import bf.yaaba.web.Dto.AudioView;
import bf.yaaba.web.Dto.CommentRequest;
import bf.yaaba.web.Dto.CommentView;
import bf.yaaba.web.Dto.ContributionRequest;
import bf.yaaba.web.Dto.ContributionView;
import bf.yaaba.web.Dto.ContributorView;
import bf.yaaba.web.Dto.LikeRequest;
import bf.yaaba.web.Dto.LikeView;
import bf.yaaba.web.Dto.StatsView;
import bf.yaaba.web.Dto.ViewRequest;
import com.fasterxml.jackson.databind.JsonNode;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.time.Duration;
import java.util.List;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.MediaTypeFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api")
@Tag(name = "Public", description = "Contes, régions, langues, commentaires et contributions")
public class PublicController {

    private final TaleService tales;
    private final ContributionService contributions;
    private final CommentService comments;
    private final StorageService storage;

    public PublicController(TaleService tales, ContributionService contributions, CommentService comments, StorageService storage) {
        this.tales = tales;
        this.contributions = contributions;
        this.comments = comments;
        this.storage = storage;
    }

    @GetMapping("/tales")
    @Operation(summary = "Liste des contes publiés (filtrable par région et par type)")
    public List<JsonNode> tales(@RequestParam(required = false) String region, @RequestParam(required = false) String type) {
        return tales.list(region, type);
    }

    @GetMapping("/tales/{slug}")
    @Operation(summary = "Un conte complet : paragraphes, illustrations, quiz, glossaire, pistes audio")
    public JsonNode tale(@PathVariable String slug) {
        return tales.get(slug);
    }

    @PostMapping("/tales/{slug}/view")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Compte une lecture (avec la langue de lecture)")
    public void view(@PathVariable String slug, @RequestBody(required = false) ViewRequest body) {
        tales.view(slug, body == null ? null : body.lang());
    }

    @PostMapping("/tales/{slug}/like")
    public LikeView like(@PathVariable String slug, @RequestBody LikeRequest body) {
        return new LikeView(tales.like(slug, body.liked()));
    }

    @GetMapping("/tales/{slug}/audio")
    public List<AudioView> audio(@PathVariable String slug) {
        return tales.audio(slug);
    }

    @GetMapping("/tales/{slug}/comments")
    @Operation(summary = "Commentaires visibles d'un conte")
    public List<CommentView> comments(@PathVariable String slug) {
        return comments.forTale(slug);
    }

    @PostMapping("/tales/{slug}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Publier un commentaire ou une réponse (connecté)")
    public CommentView comment(@PathVariable String slug, @Valid @RequestBody CommentRequest req) {
        return comments.add(slug, req);
    }

    @DeleteMapping("/comments/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteComment(@PathVariable long id) {
        comments.delete(id);
    }

    @GetMapping("/regions")
    public List<JsonNode> regions() {
        return tales.references(Reference.Kind.REGION);
    }

    @GetMapping("/languages")
    public List<JsonNode> languages() {
        return tales.references(Reference.Kind.LANGUAGE);
    }

    @GetMapping("/stats")
    public StatsView stats() {
        return tales.stats();
    }

    @GetMapping("/contributors")
    @Operation(summary = "Contributeurs dont au moins une contribution a été acceptée")
    public List<ContributorView> contributors() {
        return tales.contributors();
    }

    @PostMapping(value = "/contributions", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Soumettre une contribution (connecté) : récit et/ou enregistrement audio")
    public ContributionView contribute(@Valid @RequestPart("data") ContributionRequest data,
                                       @RequestPart(value = "audio", required = false) MultipartFile audio,
                                       @RequestPart(value = "segments", required = false) List<MultipartFile> segments) {
        return contributions.create(data, audio, segments);
    }

    @GetMapping("/media/{file}")
    public ResponseEntity<Resource> media(@PathVariable String file) {
        return storage.load(file)
                .map(r -> ResponseEntity.ok()
                        .contentType(MediaTypeFactory.getMediaType(file).orElse(MediaType.APPLICATION_OCTET_STREAM))
                        .cacheControl(CacheControl.maxAge(Duration.ofDays(30)))
                        .body(r))
                .orElse(ResponseEntity.notFound().build());
    }
}
