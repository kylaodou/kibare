package bf.yaaba.service;

import bf.yaaba.domain.Reference;
import bf.yaaba.domain.Tale;
import bf.yaaba.repo.Repositories.ReferenceRepository;
import bf.yaaba.repo.Repositories.TaleRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Charge le contenu éditorial (contes, régions, langues) depuis resources/seed au démarrage. */
@Component
public class SeedService implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(SeedService.class);

    private final TaleRepository tales;
    private final ReferenceRepository references;
    private final ObjectMapper mapper;
    private final TaleService taleService;
    private final bf.yaaba.repo.Repositories.UserRepository userRepository;

    public SeedService(TaleRepository tales, ReferenceRepository references, ObjectMapper mapper, TaleService taleService,
                       bf.yaaba.repo.Repositories.UserRepository userRepository) {
        this.userRepository = userRepository;
        this.taleService = taleService;
        this.tales = tales;
        this.references = references;
        this.mapper = mapper;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) throws IOException {
        int position = 0;
        for (JsonNode node : read("seed/tales.json")) {
            String slug = node.get("slug").asText();
            Tale t = tales.findById(slug).orElseGet(Tale::new);
            t.setSlug(slug);
            t.setType(node.path("type").asText());
            t.setRegion(node.path("region").asText());
            t.setPlace(node.path("place").asText());
            t.setPeople(node.path("people").asText());
            t.setLanguage(node.path("language").asText());
            t.setTitle(node.path("i18n").path("fr").path("title").asText(slug));
            t.setLatitude(node.path("coords").path(0).asDouble());
            t.setLongitude(node.path("coords").path(1).asDouble());
            t.setDuration(node.path("duration").asInt());
            t.setAge(node.path("age").asInt());
            t.setFeatured(node.path("featured").asBoolean());
            t.setPosition(position++);
            t.setContent(mapper.writeValueAsString(node));
            tales.save(t);
        }
        tales.flush();
        // comptes Google créés avant le 2 nov. 2026 : signalés sans mot de passe (lien « choisir mon mot de passe » proposé)
        int google = userRepository.markGoogleWithoutPassword(java.time.Instant.parse("2026-11-01T00:00:00Z"));
        if (google > 0) log.info("{} compte(s) Google sans mot de passe signalé(s)", google);
        int expanded = taleService.expandLegacyTracks();
        if (expanded > 0) log.info("{} voix communautaires rattachées à leurs paragraphes", expanded);
        // contes créés dans l'éditeur avant l'ajout de la colonne titre
        for (Tale t : tales.findAll()) if (t.getTitle() == null || t.getTitle().isBlank()) taleService.refreshTitle(t);
        seedReferences("seed/regions.json", Reference.Kind.REGION);
        seedReferences("seed/languages.json", Reference.Kind.LANGUAGE);
        log.info("Contenu chargé : {} contes, {} régions, {} langues", tales.count(),
                references.countByKind(Reference.Kind.REGION), references.countByKind(Reference.Kind.LANGUAGE));
    }

    private void seedReferences(String path, Reference.Kind kind) throws IOException {
        int position = 0;
        java.util.Set<String> codes = new java.util.HashSet<>();
        for (JsonNode node : read(path)) {
            String code = node.get("code").asText();
            codes.add(code);
            references.save(new Reference(kind, code, position++, mapper.writeValueAsString(node)));
        }
        // les entrées disparues du contenu (ex. les 13 anciennes régions) sont retirées
        references.findByKindOrderByPositionAsc(kind).stream()
                .filter(r -> !codes.contains(r.getCode()))
                .forEach(references::delete);
    }

    private JsonNode read(String path) throws IOException {
        try (InputStream in = new ClassPathResource(path).getInputStream()) {
            return mapper.readTree(in);
        }
    }
}
