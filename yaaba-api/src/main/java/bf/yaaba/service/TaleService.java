package bf.yaaba.service;

import bf.yaaba.domain.ActivityEvent;
import bf.yaaba.domain.AudioTrack;
import bf.yaaba.domain.Comment;
import bf.yaaba.domain.Contribution;
import bf.yaaba.domain.Reference;
import bf.yaaba.domain.Tale;
import bf.yaaba.domain.User;
import bf.yaaba.repo.Repositories.AudioTrackRepository;
import bf.yaaba.repo.Repositories.CommentRepository;
import bf.yaaba.repo.Repositories.ContributionRepository;
import bf.yaaba.repo.Repositories.ReferenceRepository;
import bf.yaaba.repo.Repositories.TaleRepository;
import bf.yaaba.repo.Repositories.UserRepository;
import bf.yaaba.web.Dto.AudioView;
import bf.yaaba.web.Dto.ContributorView;
import bf.yaaba.web.Dto.StatsView;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class TaleService {

    private final TaleRepository tales;
    private final ReferenceRepository references;
    private final AudioTrackRepository audio;
    private final ContributionRepository contributions;
    private final UserRepository users;
    private final CommentRepository comments;
    private final StorageService storage;
    private final ActivityService activity;
    private final ObjectMapper mapper;

    public TaleService(TaleRepository tales, ReferenceRepository references, AudioTrackRepository audio,
                       ContributionRepository contributions, UserRepository users, CommentRepository comments,
                       StorageService storage, ActivityService activity, ObjectMapper mapper) {
        this.tales = tales;
        this.references = references;
        this.audio = audio;
        this.contributions = contributions;
        this.users = users;
        this.comments = comments;
        this.storage = storage;
        this.activity = activity;
        this.mapper = mapper;
    }

    /* ------------------------------------------------------------ lecture */

    @Transactional(readOnly = true)
    public List<JsonNode> list(String region, String type) {
        Map<String, List<AudioView>> tracks = audio.findAll().stream()
                .collect(Collectors.groupingBy(AudioTrack::getTaleSlug, Collectors.mapping(AudioView::of, Collectors.toList())));
        return tales.findByPublishedTrueOrderByPositionAsc().stream()
                .filter(t -> region == null || region.equals(t.getRegion()))
                .filter(t -> type == null || type.equals(t.getType()))
                .map(t -> toJson(t, tracks.getOrDefault(t.getSlug(), List.of())))
                .toList();
    }

    @Transactional(readOnly = true)
    public JsonNode get(String slug) {
        Tale t = find(slug);
        if (!t.isPublished()) throw new NotFoundException("Conte introuvable : " + slug);
        return toJson(t, audio(slug));
    }

    @Transactional
    public void view(String slug, String lang) {
        if (tales.incrementViews(slug) == 0) throw new NotFoundException("Conte introuvable : " + slug);
        activity.log(ActivityEvent.Kind.VIEW, slug, lang);
    }

    @Transactional
    public long like(String slug, boolean liked) {
        Tale t = find(slug);
        t.setLikes(Math.max(0, t.getLikes() + (liked ? 1 : -1)));
        if (liked) activity.log(ActivityEvent.Kind.LIKE, slug, null);
        return t.getLikes();
    }

    @Transactional(readOnly = true)
    public List<AudioView> audio(String slug) {
        return audio.findByTaleSlugOrderByCreatedAtAsc(slug).stream().map(AudioView::of).toList();
    }

    @Transactional(readOnly = true)
    public List<JsonNode> references(Reference.Kind kind) {
        return references.findByKindOrderByPositionAsc(kind).stream().map(r -> parse(r.getContent())).toList();
    }

    @Transactional(readOnly = true)
    public StatsView stats() {
        return new StatsView(
                tales.findByPublishedTrueOrderByPositionAsc().size(),
                references.countByKind(Reference.Kind.REGION),
                references.countByKind(Reference.Kind.LANGUAGE),
                audio.count(),
                contributions.count(),
                contributions.countByStatus(Contribution.Status.PENDING),
                tales.totalViews(),
                users.count(),
                comments.count());
    }

    /** Contributeurs publics : utilisateurs ayant au moins une contribution acceptée. */
    @Transactional(readOnly = true)
    public List<ContributorView> contributors() {
        Map<Long, List<Contribution>> byUser = contributions.findByStatus(Contribution.Status.APPROVED).stream()
                .filter(c -> c.getUserId() != null)
                .collect(Collectors.groupingBy(Contribution::getUserId));
        return users.findAllById(byUser.keySet()).stream()
                .filter(User::isActive)
                .map(u -> {
                    List<Contribution> list = byUser.get(u.getId());
                    List<String> slugs = list.stream()
                            .map(c -> c.getPublishedSlug() != null ? c.getPublishedSlug() : c.getTaleSlug())
                            .filter(Objects::nonNull).distinct().toList();
                    return new ContributorView(u.getId(), u.getName(), u.getRegion(), u.getLanguage(), u.getBio(),
                            list.size(), slugs, u.getCreatedAt());
                })
                .sorted(Comparator.comparingLong(ContributorView::approved).reversed())
                .toList();
    }

    public boolean exists(String slug) {
        return tales.existsById(slug);
    }

    @Transactional(readOnly = true)
    public String title(String slug) {
        return tales.findById(slug).map(t -> parse(t.getContent()).path("i18n").path("fr").path("title").asText(slug)).orElse(slug);
    }

    /* ---------------------------------------------- publication communauté */

    @Transactional
    public String publishFromContribution(Contribution c) {
        String lang = c.getLanguage() == null ? "fr" : c.getLanguage();
        String slug = uniqueSlug(c.getTitle());
        ObjectNode n = mapper.createObjectNode();
        n.put("slug", slug);
        n.put("type", c.getTaleType() == null ? "conte" : c.getTaleType());
        String region = c.getRegion() == null ? "centre" : c.getRegion();
        n.put("region", region);
        JsonNode regionInfo = references.findById("REGION:" + region).map(r -> parse(r.getContent())).orElse(null);
        n.put("place", regionInfo == null ? "" : regionInfo.path("capital").asText(""));
        ArrayNode coords = n.putArray("coords");
        coords.add(regionInfo == null ? 12.37 : regionInfo.path("center").path(0).asDouble() + (Math.random() - 0.5) * 0.3);
        coords.add(regionInfo == null ? -1.52 : regionInfo.path("center").path(1).asDouble() + (Math.random() - 0.5) * 0.3);
        n.put("people", "");
        n.put("language", lang);
        String text = c.getText() == null ? "" : c.getText();
        n.put("duration", Math.max(2, Math.round(text.split("\\s+").length / 150f)));
        n.put("age", 6);
        n.put("featured", false);
        n.put("cover", 0);
        n.putArray("tags").add("communauté");

        ObjectNode i18n = n.putObject("i18n");
        for (String l : lang.equals("fr") ? List.of("fr") : List.of(lang, "fr")) {
            ObjectNode t = i18n.putObject(l);
            t.put("title", c.getTitle());
            t.put("subtitle", "Conte partagé par " + c.getAuthorName());
            t.put("summary", c.getSummary() == null ? firstWords(text, 40) : c.getSummary());
            t.put("moral", c.getMoral() == null ? "" : c.getMoral());
        }

        ArrayNode scenes = n.putArray("scenes");
        String[] skies = {"day", "dusk", "night", "dawn"};
        List<String> paragraphs = paragraphs(text);
        for (int i = 0; i < paragraphs.size(); i++) {
            ObjectNode s = scenes.addObject();
            s.set("art", defaultArt(skies[i % skies.length], i));
            s.putObject("text").put(lang, paragraphs.get(i));
        }
        n.putArray("quiz");
        n.putArray("glossary");
        ObjectNode source = n.putObject("source");
        source.put("fr", "Conte partagé par " + c.getAuthorName() + " sur la plateforme KIBARE, validé par l'équipe.");
        source.put("en", "Tale shared by " + c.getAuthorName() + " on the KIBARE platform, reviewed by the team.");
        ArrayNode contributors = n.putArray("contributors");
        ObjectNode who = contributors.addObject();
        who.put("name", c.getAuthorName());
        who.put("role", "author");
        if (c.getUserId() != null) who.put("userId", c.getUserId());

        Tale t = new Tale();
        apply(t, n);
        t.setOrigin("community");
        t.setAuthorUserId(c.getUserId());
        t.setPosition(tales.maxPosition() + 1);
        tales.save(t);
        return slug;
    }

    @Transactional
    public void setPublished(String slug, boolean published) {
        tales.findById(slug).ifPresent(t -> t.setPublished(published));
    }

    /* ------------------------------------------------- édition (admin) */

    @Transactional(readOnly = true)
    public List<Map<String, Object>> adminList() {
        return tales.findAllByOrderByPositionAsc().stream().map(t -> {
            JsonNode c = parse(t.getContent());
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("slug", t.getSlug());
            m.put("title", c.path("i18n").path("fr").path("title").asText(t.getSlug()));
            m.put("type", t.getType());
            m.put("region", t.getRegion());
            m.put("language", t.getLanguage());
            m.put("origin", t.getOrigin());
            m.put("published", t.isPublished());
            m.put("featured", t.isFeatured());
            m.put("views", t.getViews());
            m.put("likes", t.getLikes());
            m.put("comments", comments.countByTaleSlugAndStatus(t.getSlug(), Comment.Status.VISIBLE));
            m.put("audio", audio.findByTaleSlugOrderByCreatedAtAsc(t.getSlug()).size());
            m.put("languages", iterable(c.path("i18n").fieldNames()));
            return m;
        }).toList();
    }

    @Transactional(readOnly = true)
    public JsonNode adminGet(String slug) {
        Tale t = find(slug);
        ObjectNode n = (ObjectNode) toJson(t, audio(slug));
        n.put("published", t.isPublished());
        n.put("origin", t.getOrigin());
        return n;
    }

    @Transactional
    public JsonNode save(String slug, JsonNode body) {
        if (!(body instanceof ObjectNode n)) throw new IllegalArgumentException("Contenu invalide");
        validate(n);
        Tale t = slug == null ? null : tales.findById(slug).orElse(null);
        if (t == null) {
            String newSlug = n.path("slug").asText("").isBlank() ? uniqueSlug(n.path("i18n").path("fr").path("title").asText()) : n.path("slug").asText();
            if (tales.existsById(newSlug)) throw new ConflictException("Ce slug existe déjà");
            n.put("slug", newSlug);
            t = new Tale();
            t.setOrigin("admin");
            t.setPosition(tales.maxPosition() + 1);
        } else {
            n.put("slug", t.getSlug());
        }
        n.remove(List.of("views", "likes", "audio", "published", "origin"));
        apply(t, n);
        if (body.has("published")) t.setPublished(body.path("published").asBoolean(true));
        tales.save(t);
        return adminGet(t.getSlug());
    }

    @Transactional
    public void delete(String slug) {
        Tale t = find(slug);
        audio.findByTaleSlugOrderByCreatedAtAsc(slug).forEach(a -> {
            audio.delete(a);
            if (a.getContributionId() == null) storage.delete(a.getFileName());
        });
        tales.delete(t);
    }

    @Transactional
    public AudioView addAudio(String slug, String lang, String narrator, MultipartFile file) {
        find(slug);
        StorageService.Stored stored = storage.storeAudio(file);
        return AudioView.of(audio.save(new AudioTrack(slug, lang, narrator, stored.fileName(), stored.contentType(), null)));
    }

    @Transactional
    public void deleteAudio(long id) {
        AudioTrack t = audio.findById(id).orElseThrow(() -> new NotFoundException("Piste introuvable"));
        audio.delete(t);
        if (t.getContributionId() == null) storage.delete(t.getFileName());
    }

    /* ------------------------------------------------------------ outils */

    private void validate(ObjectNode n) {
        if (n.path("i18n").path("fr").path("title").asText("").isBlank()) throw new IllegalArgumentException("Le titre français est obligatoire");
        if (!n.path("scenes").isArray() || n.path("scenes").isEmpty()) throw new IllegalArgumentException("Au moins un paragraphe est requis");
        if (!List.of("conte", "legende", "recit").contains(n.path("type").asText())) throw new IllegalArgumentException("Type invalide");
        if (n.path("region").asText("").isBlank()) throw new IllegalArgumentException("La région est obligatoire");
    }

    private void apply(Tale t, JsonNode n) {
        t.setSlug(n.path("slug").asText());
        t.setType(n.path("type").asText("conte"));
        t.setRegion(n.path("region").asText());
        t.setPlace(n.path("place").asText(""));
        t.setPeople(n.path("people").asText(""));
        t.setLanguage(n.path("language").asText("fr"));
        t.setLatitude(n.path("coords").path(0).asDouble(12.37));
        t.setLongitude(n.path("coords").path(1).asDouble(-1.52));
        t.setDuration(n.path("duration").asInt(5));
        t.setAge(n.path("age").asInt(6));
        t.setFeatured(n.path("featured").asBoolean(false));
        try {
            t.setContent(mapper.writeValueAsString(n));
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Contenu invalide");
        }
    }

    private String uniqueSlug(String title) {
        String base = Normalizer.normalize(title == null ? "conte" : title, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
        if (base.isBlank()) base = "conte";
        if (base.length() > 80) base = base.substring(0, 80);
        String slug = base;
        for (int i = 2; tales.existsById(slug); i++) slug = base + "-" + i;
        return slug;
    }

    private static List<String> paragraphs(String text) {
        List<String> out = new ArrayList<>();
        for (String p : text.strip().split("\\n\\s*\\n|\\r\\n\\s*\\r\\n")) {
            String s = p.replaceAll("\\s+", " ").strip();
            if (!s.isEmpty()) out.add(s);
        }
        if (out.size() == 1 && out.get(0).length() > 700) {
            // un seul bloc : on le découpe par groupes de phrases
            String[] sentences = out.get(0).split("(?<=[.!?…])\\s+");
            out.clear();
            StringBuilder b = new StringBuilder();
            for (String s : sentences) {
                b.append(s).append(' ');
                if (b.length() > 380) {
                    out.add(b.toString().strip());
                    b.setLength(0);
                }
            }
            if (!b.isEmpty()) out.add(b.toString().strip());
        }
        return out.isEmpty() ? List.of(text) : out;
    }

    private ObjectNode defaultArt(String sky, int i) {
        ObjectNode art = mapper.createObjectNode();
        art.put("sky", sky);
        art.put("ground", i % 2 == 0 ? "village" : "savanna");
        ArrayNode items = art.putArray("items");
        items.addObject().put("k", sky.equals("night") ? "moon" : "sun").put("x", 82).put("y", 300);
        items.addObject().put("k", "baobab").put("x", 18).put("y", 26);
        if (sky.equals("night")) {
            items.addObject().put("k", "fire").put("x", 50);
            items.addObject().put("k", "elder-sit").put("x", 36);
            items.addObject().put("k", "child-sit").put("x", 64).put("flip", true);
        } else {
            items.addObject().put("k", "hut").put("x", 72).put("y", 26);
            items.addObject().put("k", i % 2 == 0 ? "woman-talk" : "man-talk").put("x", 44);
            items.addObject().put("k", "child").put("x", 56);
        }
        return art;
    }

    private static String firstWords(String text, int n) {
        String[] w = text.strip().split("\\s+");
        return w.length <= n ? text.strip() : String.join(" ", List.of(w).subList(0, n)) + "…";
    }

    private static List<String> iterable(java.util.Iterator<String> it) {
        List<String> l = new ArrayList<>();
        it.forEachRemaining(l::add);
        return l;
    }

    private Tale find(String slug) {
        return tales.findById(slug).orElseThrow(() -> new NotFoundException("Conte introuvable : " + slug));
    }

    private JsonNode toJson(Tale t, List<AudioView> tracks) {
        ObjectNode node = (ObjectNode) parse(t.getContent());
        node.put("views", t.getViews());
        node.put("likes", t.getLikes());
        node.put("origin", t.getOrigin());
        node.put("comments", comments.countByTaleSlugAndStatus(t.getSlug(), Comment.Status.VISIBLE));
        node.set("audio", mapper.valueToTree(tracks));
        return node;
    }

    private JsonNode parse(String json) {
        try {
            return mapper.readTree(json);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Contenu JSON invalide", e);
        }
    }
}
