package bf.yaaba.service;

import bf.yaaba.domain.ActivityEvent;
import bf.yaaba.domain.AudioTrack;
import bf.yaaba.domain.Contribution;
import bf.yaaba.domain.Notification;
import bf.yaaba.domain.User;
import bf.yaaba.repo.Repositories.AudioTrackRepository;
import bf.yaaba.repo.Repositories.ContributionRepository;
import bf.yaaba.web.Dto.ContributionRequest;
import bf.yaaba.web.Dto.ContributionView;
import bf.yaaba.web.Dto.PageView;
import bf.yaaba.web.Dto.RecordingView;
import bf.yaaba.config.YaabaProperties;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * Cycle de vie des contributions : dépôt par un utilisateur connecté, notification aux administrateurs,
 * puis modération. Valider une « voix » publie l'enregistrement sur le conte ; valider un « récit »
 * publie un nouveau conte crédité à son auteur. L'auteur est notifié de la décision.
 */
@Service
public class ContributionService {

    private final ContributionRepository contributions;
    private final AudioTrackRepository audio;
    private final StorageService storage;
    private final TaleService tales;
    private final AuthService auth;
    private final NotificationService notifications;
    private final ActivityService activity;
    private final YaabaProperties props;

    public ContributionService(ContributionRepository contributions, AudioTrackRepository audio, StorageService storage,
                               TaleService tales, AuthService auth, NotificationService notifications, ActivityService activity,
                               YaabaProperties props) {
        this.props = props;
        this.contributions = contributions;
        this.audio = audio;
        this.storage = storage;
        this.tales = tales;
        this.auth = auth;
        this.notifications = notifications;
        this.activity = activity;
    }

    @Transactional
    public ContributionView create(ContributionRequest req, MultipartFile file, List<MultipartFile> segments, List<String> sceneIds) {
        List<MultipartFile> parts = segments == null ? List.of() : segments.stream().filter(f -> f != null && !f.isEmpty()).toList();
        if (!req.consent()) throw new IllegalArgumentException("Le consentement est requis");
        User user = auth.current();
        if (props.mail() != null && props.mail().requireVerified() && !user.isEmailVerified())
            throw new ForbiddenException("Confirmez d'abord votre adresse e-mail (lien reçu à l'inscription) pour contribuer");
        Contribution.Kind kind = Contribution.Kind.valueOf(req.kind());
        if (kind == Contribution.Kind.voice) {
            if (req.taleSlug() == null || !tales.exists(req.taleSlug())) throw new IllegalArgumentException("Conte inconnu");
            if ((file == null || file.isEmpty()) && parts.isEmpty())
                throw new IllegalArgumentException("Un enregistrement est requis pour prêter sa voix");
            if (!parts.isEmpty()) {
                // chaque enregistrement doit désigner son paragraphe : jamais d'association par la seule position
                if (sceneIds == null || sceneIds.size() != parts.size())
                    throw new IllegalArgumentException("Chaque enregistrement doit indiquer son paragraphe");
                java.util.Set<String> known = tales.sceneTexts(req.taleSlug()).keySet();
                for (String id : sceneIds)
                    if (id == null || !known.contains(id)) throw new IllegalArgumentException("Paragraphe inconnu pour ce conte");
                if (new java.util.HashSet<>(sceneIds).size() != sceneIds.size())
                    throw new IllegalArgumentException("Un même paragraphe est enregistré deux fois");
            }
        } else if (req.text() == null || req.text().strip().length() < 40) {
            throw new IllegalArgumentException("Le texte du conte est trop court");
        }

        Contribution c = new Contribution();
        c.setKind(kind);
        c.setUserId(user.getId());
        c.setTaleSlug(kind == Contribution.Kind.voice ? req.taleSlug() : null);
        c.setTitle(req.title().strip());
        c.setRegion(req.region());
        c.setLanguage(req.language());
        c.setTaleType(req.taleType());
        c.setSummary(blankToNull(req.summary()));
        c.setMoral(blankToNull(req.moral()));
        c.setAuthorName(user.getName());
        c.setAuthorEmail(user.getEmail());
        c.setText(blankToNull(req.text()));
        c.setConsent(true);
        if (file != null && !file.isEmpty()) {
            StorageService.Stored stored = storage.storeAudio(file);
            c.setAudioFile(stored.fileName());
            c.setAudioContentType(stored.contentType());
        }
        if (!parts.isEmpty()) {
            List<String> names = new java.util.ArrayList<>();
            for (MultipartFile part : parts) {
                StorageService.Stored stored = storage.storeAudio(part);
                names.add(stored.fileName());
                if (c.getAudioFile() == null) c.setAudioContentType(stored.contentType());
            }
            c.setSegmentFiles(String.join(",", names));
            c.setSegmentScenes(String.join(",", sceneIds));
            if (c.getAudioFile() == null) c.setAudioFile(names.get(0));
        }
        contributions.save(c);
        activity.log(ActivityEvent.Kind.CONTRIBUTION, c.getTaleSlug(), c.getLanguage());
        String what = kind == Contribution.Kind.voice ? "une voix pour" : "un nouveau récit :";
        notifications.toAdmins(Notification.Type.NEW_CONTRIBUTION,
                user.getName() + " a proposé " + what + " « " + c.getTitle() + " »", "/admin/contributions");
        return view(c);
    }

    @Transactional(readOnly = true)
    public List<ContributionView> mine() {
        return contributions.findByUserIdOrderByCreatedAtDesc(auth.current().getId()).stream().map(this::view).toList();
    }

    @Transactional(readOnly = true)
    public List<ContributionView> list() {
        return contributions.findAllByOrderByCreatedAtDesc().stream().map(this::view).toList();
    }

    private static final Map<String, String> SORTS = Map.of(
            "createdAt", "createdAt", "title", "title", "authorName", "authorName", "language", "language", "status", "status");

    /** Liste paginée, recherchée et triée côté serveur ; counts = compteurs des onglets. */
    @Transactional(readOnly = true)
    public PageView<ContributionView> page(String status, String q, int page, int size, String sortSpec) {
        Contribution.Status st = status == null || status.isBlank() || status.equals("ALL") ? null : Contribution.Status.valueOf(status);
        Sort sort = TaleService.sort(sortSpec, SORTS, Sort.by(Sort.Order.desc("createdAt")));
        Page<Contribution> p = contributions.search(st, TaleService.like(q), TaleService.pageable(page, size, sort));
        Map<String, Long> counts = new LinkedHashMap<>();
        long all = 0;
        for (Contribution.Status s : Contribution.Status.values()) {
            long n = contributions.countByStatus(s);
            counts.put(s.name(), n);
            all += n;
        }
        counts.put("ALL", all);
        return new PageView<>(p.getContent().stream().map(this::view).toList(), p.getTotalElements(), p.getNumber(), p.getSize(), counts);
    }

    /**
     * Vue complète : chaque enregistrement avec le numéro et le texte exact de son paragraphe,
     * retrouvés par l'identifiant de scène enregistré (ou, pour une ancienne contribution, par l'ordre).
     */
    private ContributionView view(Contribution c) {
        if (c.getSegmentFiles() == null || c.getSegmentFiles().isBlank() || c.getTaleSlug() == null) return ContributionView.of(c);
        Map<String, JsonNode> scenes = tales.sceneTexts(c.getTaleSlug());
        List<String> ids = new ArrayList<>(scenes.keySet());
        String[] files = c.getSegmentFiles().split(",");
        String[] sceneIds = c.getSegmentScenes() == null || c.getSegmentScenes().isBlank() ? new String[0] : c.getSegmentScenes().split(",");
        List<RecordingView> out = new ArrayList<>();
        for (int i = 0; i < files.length; i++) {
            String url = StorageService.mediaUrl(files[i]);
            String sceneId = i < sceneIds.length ? sceneIds[i] : null;
            String matched = sceneId != null ? "scene" : "order";
            if (sceneId == null && i < ids.size()) sceneId = ids.get(i);
            int index = sceneId == null ? -1 : ids.indexOf(sceneId);
            if (index < 0) {
                out.add(new RecordingView(url, sceneId, null, null, "none"));
                continue;
            }
            JsonNode text = scenes.get(sceneId);
            String t = text.path(c.getLanguage()).asText("");
            if (t.isBlank()) t = text.path("fr").asText("");
            out.add(new RecordingView(url, sceneId, index + 1, t.isBlank() ? null : t, matched));
        }
        return ContributionView.of(c, out);
    }

    @Transactional
    public ContributionView approve(long id, String note) {
        Contribution c = find(id);
        if (c.getStatus() == Contribution.Status.APPROVED) throw new ConflictException("Cette contribution est déjà validée");
        {
            if (c.getKind() == Contribution.Kind.voice && c.getSegmentFiles() != null && !c.getSegmentFiles().isBlank()) {
                // une piste par paragraphe, rattachée à l'identifiant de scène enregistré avec la contribution
                String[] files = c.getSegmentFiles().split(",");
                List<RecordingView> recs = view(c).recordings();
                for (int i = 0; i < recs.size() && i < files.length; i++) {
                    RecordingView r = recs.get(i);
                    if (r.sceneId() == null || r.paragraph() == null) continue;
                    String file = files[i];
                    AudioTrack track = new AudioTrack(c.getTaleSlug(), c.getLanguage(), c.getAuthorName(), file, c.getAudioContentType(), c.getId());
                    track.setSceneId(r.sceneId());
                    audio.save(track);
                }
            } else if (c.getKind() == Contribution.Kind.voice && c.getAudioFile() != null) {
                audio.save(new AudioTrack(c.getTaleSlug(), c.getLanguage(), c.getAuthorName(), c.getAudioFile(), c.getAudioContentType(), c.getId()));
            }
            if (c.getKind() == Contribution.Kind.story && c.getPublishedSlug() == null) {
                c.setPublishedSlug(tales.publishFromContribution(c));
            } else if (c.getPublishedSlug() != null) {
                tales.setPublished(c.getPublishedSlug(), true);
            }
        }
        c.setStatus(Contribution.Status.APPROVED);
        c.setReviewNote(blankToNull(note));
        c.setReviewedAt(Instant.now());
        String link = c.getKind() == Contribution.Kind.voice ? "/contes/" + c.getTaleSlug()
                : c.getPublishedSlug() != null ? "/contes/" + c.getPublishedSlug() : "/compte";
        notifications.toUser(c.getUserId(), Notification.Type.CONTRIBUTION_APPROVED,
                "Bonne nouvelle ! Votre contribution « " + c.getTitle() + " » a été acceptée et publiée.", link);
        return view(c);
    }

    @Transactional
    public ContributionView reject(long id, String note) {
        Contribution c = find(id);
        // seule une contribution en attente peut être refusée : une contribution validée reste publiée
        if (c.getStatus() == Contribution.Status.APPROVED) throw new ConflictException("Une contribution validée ne peut plus être refusée");
        if (c.getStatus() == Contribution.Status.REJECTED) throw new ConflictException("Cette contribution est déjà refusée");
        unpublish(c);
        c.setStatus(Contribution.Status.REJECTED);
        c.setReviewNote(blankToNull(note));
        c.setReviewedAt(Instant.now());
        notifications.toUser(c.getUserId(), Notification.Type.CONTRIBUTION_REJECTED,
                "Votre contribution « " + c.getTitle() + " » n'a pas été retenue"
                        + (c.getReviewNote() != null ? " : " + c.getReviewNote() : "."), "/compte");
        return view(c);
    }

    @Transactional
    public void delete(long id) {
        Contribution c = find(id);
        unpublish(c);
        storage.delete(c.getAudioFile());
        if (c.getSegmentFiles() != null)
            for (String f : c.getSegmentFiles().split(",")) if (!f.equals(c.getAudioFile())) storage.delete(f);
        contributions.delete(c);
    }

    private void unpublish(Contribution c) {
        audio.findByContributionId(c.getId()).forEach(audio::delete);
        if (c.getPublishedSlug() != null) tales.setPublished(c.getPublishedSlug(), false);
    }

    private Contribution find(long id) {
        return contributions.findById(id).orElseThrow(() -> new NotFoundException("Contribution introuvable"));
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.strip();
    }
}
