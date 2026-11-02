package bf.yaaba;

import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import bf.yaaba.domain.PasswordReset;
import bf.yaaba.repo.Repositories.PasswordResetRepository;
import bf.yaaba.repo.Repositories.UserRepository;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Comparator;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:kibare-test",
        "yaaba.storage-dir=target/test-uploads",
        "yaaba.mail.outbox-dir=target/test-outbox",
        "yaaba.mail.require-verified=false",
        "spring.mail.host=",
        "yaaba.google.client-id="})
@AutoConfigureMockMvc
class YaabaApiTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired PasswordResetRepository resets;
    @Autowired UserRepository users;

    private static final String ADMIN = "admin@kibare.bf";

    /** Dernier e-mail déposé dans la boîte de développement pour cette adresse. */
    private String lastMail(String email) throws Exception {
        try (var files = Files.list(Path.of("target/test-outbox"))) {
            return files.sorted(Comparator.comparing(Path::getFileName).reversed())
                    .map(f -> { try { return Files.readString(f, StandardCharsets.UTF_8); } catch (Exception e) { return ""; } })
                    .filter(html -> html.startsWith("<!-- À : " + email + " "))
                    .findFirst().orElseThrow(() -> new AssertionError("aucun e-mail pour " + email));
        }
    }

    private String find(String text, String regex) {
        Matcher m = Pattern.compile(regex).matcher(text);
        if (!m.find()) throw new AssertionError("motif introuvable : " + regex);
        return m.group(1);
    }


    private String login(String email, String password) throws Exception {
        String body = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return "Bearer " + mapper.readTree(body).get("token").asText();
    }

    private String register(String name) throws Exception {
        String email = UUID.randomUUID() + "@test.bf";
        String body = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"" + name + "\",\"email\":\"" + email + "\",\"password\":\"motdepasse1\",\"region\":\"centre\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return "Bearer " + mapper.readTree(body).get("token").asText();
    }

    @Test
    void catalogueEstCharge() throws Exception {
        mvc.perform(get("/api/tales")).andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(14))));
        mvc.perform(get("/api/regions")).andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(17)));
        mvc.perform(get("/api/tales/yennenga")).andExpect(status().isOk())
                .andExpect(jsonPath("$.i18n.fr.title").value("Yennenga, la princesse cavalière"));
        mvc.perform(get("/api/tales/inconnu")).andExpect(status().isNotFound());
    }

    @Test
    void inscriptionEtConnexion() throws Exception {
        String token = register("Awa");
        mvc.perform(get("/api/me").header("Authorization", token)).andExpect(status().isOk()).andExpect(jsonPath("$.name").value("Awa"));
        mvc.perform(get("/api/me")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"admin@kibare.bf\",\"password\":\"mauvais\"}")).andExpect(status().isUnauthorized());
    }

    @Test
    void administrationReserveeAuxAdmins() throws Exception {
        String user = register("Moussa");
        mvc.perform(get("/api/admin/dashboard")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/dashboard").header("Authorization", user)).andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/dashboard").header("Authorization", login("admin@kibare.bf", "kibare2026")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.daily", hasSize(30)));
    }

    @Test
    void voixValideeEstPublieeEtAuteurNotifie() throws Exception {
        String user = register("Mariam");
        String data = """
                {"kind":"voice","taleSlug":"crocodiles-sabou","title":"Les crocodiles sacrés de Sabou",
                 "region":"nando","language":"moore","consent":true}""";
        MockMultipartFile json = new MockMultipartFile("data", "", "application/json", data.getBytes());
        MockMultipartFile audio = new MockMultipartFile("audio", "voix.webm", "audio/webm", new byte[] {1, 2, 3, 4});

        mvc.perform(multipart("/api/contributions").file(json).file(audio)).andExpect(status().isUnauthorized());
        String body = mvc.perform(multipart("/api/contributions").file(json).file(audio).header("Authorization", user))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.status").value("PENDING"))
                .andReturn().getResponse().getContentAsString();
        long id = mapper.readTree(body).get("id").asLong();

        String admin = login("admin@kibare.bf", "kibare2026");
        mvc.perform(get("/api/me/notifications").header("Authorization", admin))
                .andExpect(jsonPath("$[?(@.type == 'NEW_CONTRIBUTION')]").exists());

        mvc.perform(post("/api/admin/contributions/" + id + "/approve").header("Authorization", admin))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("APPROVED"));

        String tracks = mvc.perform(get("/api/tales/crocodiles-sabou/audio")).andExpect(jsonPath("$[0].narrator").value("Mariam"))
                .andReturn().getResponse().getContentAsString();
        JsonNode track = mapper.readTree(tracks).get(0);
        mvc.perform(get(track.get("url").asText())).andExpect(status().isOk());

        mvc.perform(get("/api/me/notifications").header("Authorization", user))
                .andExpect(jsonPath("$[0].type").value("CONTRIBUTION_APPROVED"));
        mvc.perform(get("/api/contributors")).andExpect(jsonPath("$[?(@.name == 'Mariam')]").exists());
    }

    @Test
    void voixEnregistreeParagrapheParParagraphe() throws Exception {
        String user = register("Rasmata");
        String data = """
                {"kind":"voice","taleSlug":"yennenga","title":"Yennenga","region":"nakambe","language":"moore","consent":true}""";
        MockMultipartFile json = new MockMultipartFile("data", "", "application/json", data.getBytes());
        MockMultipartFile s1 = new MockMultipartFile("segments", "paragraphe-1.webm", "audio/webm", new byte[] {1, 2});
        MockMultipartFile s3 = new MockMultipartFile("segments", "paragraphe-3.webm", "audio/webm", new byte[] {3, 4});

        // sans identifiant de paragraphe, l'enregistrement est refusé (pas d'association par position)
        mvc.perform(multipart("/api/contributions").file(json).file(s1).file(s3).header("Authorization", user))
                .andExpect(status().isBadRequest());
        mvc.perform(multipart("/api/contributions").file(json).file(s1).file(s3).param("sceneIds", "yennenga-p1", "inconnu")
                .header("Authorization", user)).andExpect(status().isBadRequest());

        String body = mvc.perform(multipart("/api/contributions").file(json).file(s1).file(s3)
                        .param("sceneIds", "yennenga-p1", "yennenga-p3").header("Authorization", user))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.segments", hasSize(2)))
                .andExpect(jsonPath("$.recordings[1].paragraph").value(3))
                .andExpect(jsonPath("$.recordings[1].sceneId").value("yennenga-p3"))
                .andExpect(jsonPath("$.recordings[1].matchedBy").value("scene"))
                .andExpect(jsonPath("$.recordings[1].text").isNotEmpty())
                .andReturn().getResponse().getContentAsString();
        long id = mapper.readTree(body).get("id").asLong();

        String admin = login(ADMIN, "kibare2026");
        mvc.perform(post("/api/admin/contributions/" + id + "/approve").header("Authorization", admin))
                .andExpect(status().isOk());
        String tracks = mvc.perform(get("/api/tales/yennenga/audio"))
                .andExpect(jsonPath("$[?(@.narrator == 'Rasmata' && @.sceneId == 'yennenga-p3')]").exists())
                .andExpect(jsonPath("$[?(@.narrator == 'Rasmata' && @.sceneId == 'yennenga-p1')]").exists())
                .andReturn().getResponse().getContentAsString();
        for (JsonNode t : mapper.readTree(tracks))
            if (t.get("narrator").asText().equals("Rasmata")) mvc.perform(get(t.get("url").asText())).andExpect(status().isOk());

        // une contribution validée ne peut plus être refusée, ni validée deux fois
        mvc.perform(post("/api/admin/contributions/" + id + "/reject").header("Authorization", admin)).andExpect(status().isConflict());
        mvc.perform(post("/api/admin/contributions/" + id + "/approve").header("Authorization", admin)).andExpect(status().isConflict());
    }

    @Test
    void refusPuisSuppressionDUneContribution() throws Exception {
        String user = register("Issa");
        String data = """
                {"kind":"voice","taleSlug":"yennenga","title":"Yennenga","region":"nakambe","language":"fr","consent":true}""";
        String body = mvc.perform(multipart("/api/contributions")
                        .file(new MockMultipartFile("data", "", "application/json", data.getBytes()))
                        .file(new MockMultipartFile("segments", "p.webm", "audio/webm", new byte[] {9}))
                        .param("sceneIds", "yennenga-p2").header("Authorization", user))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        long id = mapper.readTree(body).get("id").asLong();
        String admin = login(ADMIN, "kibare2026");

        mvc.perform(post("/api/admin/contributions/" + id + "/reject").header("Authorization", admin).contentType(MediaType.APPLICATION_JSON)
                .content("{\"note\":\"Son inaudible\"}")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("REJECTED"));
        mvc.perform(post("/api/admin/contributions/" + id + "/reject").header("Authorization", admin)).andExpect(status().isConflict());

        mvc.perform(delete("/api/admin/contributions/" + id).header("Authorization", user)).andExpect(status().isForbidden());
        mvc.perform(delete("/api/admin/contributions/" + id).header("Authorization", admin)).andExpect(status().isNoContent());
        mvc.perform(get("/api/admin/contributions").param("status", "ALL").param("size", "100").header("Authorization", admin))
                .andExpect(jsonPath("$.items[?(@.id == " + id + ")]").doesNotExist());
    }

    @Test
    void listesPagineesCoteServeur() throws Exception {
        String admin = login(ADMIN, "kibare2026");
        mvc.perform(get("/api/admin/tales").header("Authorization", admin))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items", hasSize(10)))
                .andExpect(jsonPath("$.total").value(greaterThanOrEqualTo(14))).andExpect(jsonPath("$.page").value(0));
        mvc.perform(get("/api/admin/tales").param("q", "YENNENGA").header("Authorization", admin))
                .andExpect(jsonPath("$.items[0].slug").value("yennenga"));
        mvc.perform(get("/api/admin/tales").param("sort", "title,asc").param("page", "1").header("Authorization", admin))
                .andExpect(jsonPath("$.page").value(1));
        mvc.perform(get("/api/admin/contributions").param("status", "PENDING").header("Authorization", admin))
                .andExpect(status().isOk()).andExpect(jsonPath("$.counts.ALL").exists()).andExpect(jsonPath("$.counts.PENDING").exists());
        mvc.perform(get("/api/admin/users").param("q", "admin@").header("Authorization", admin))
                .andExpect(jsonPath("$.items[0].user.email").value(ADMIN));
        mvc.perform(get("/api/admin/comments").header("Authorization", admin)).andExpect(status().isOk()).andExpect(jsonPath("$.items").isArray());
        mvc.perform(get("/api/tales/options").param("q", "sabou").param("size", "5"))
                .andExpect(jsonPath("$.items[?(@.slug == 'crocodiles-sabou')]").exists());
    }

    @Test
    void videoLimiteeA10Mo() throws Exception {
        String admin = login(ADMIN, "kibare2026");
        mvc.perform(multipart("/api/admin/media/video").file(new MockMultipartFile("video", "petite.mp4", "video/mp4", new byte[2048]))
                .header("Authorization", admin)).andExpect(status().isCreated()).andExpect(jsonPath("$.url").exists());
        mvc.perform(multipart("/api/admin/media/video")
                        .file(new MockMultipartFile("video", "grande.mp4", "video/mp4", new byte[10 * 1024 * 1024 + 1]))
                        .header("Authorization", admin))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("10 Mo")));
        mvc.perform(multipart("/api/admin/media/video").file(new MockMultipartFile("video", "x.mp4", "video/mp4", new byte[10])))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void verificationDeLAdresseEMail() throws Exception {
        String email = UUID.randomUUID() + "@test.bf";
        String body = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Salif\",\"email\":\"" + email + "\",\"password\":\"motdepasse1\",\"region\":\"centre\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.emailSent").value(true))
                .andExpect(jsonPath("$.user.emailVerified").value(false)).andReturn().getResponse().getContentAsString();
        // adresse déjà utilisée, format invalide
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Salif\",\"email\":\"" + email.toUpperCase() + "\",\"password\":\"motdepasse1\",\"region\":\"centre\"}"))
                .andExpect(status().is4xxClientError());
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Salif\",\"email\":\"pas-une-adresse\",\"password\":\"motdepasse1\",\"region\":\"centre\"}"))
                .andExpect(status().isBadRequest());

        String token = find(lastMail(email), "jeton=([A-Za-z0-9_-]+)");
        mvc.perform(post("/api/auth/verify-email").contentType(MediaType.APPLICATION_JSON).content("{\"token\":\"bidon\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/auth/verify-email").contentType(MediaType.APPLICATION_JSON).content("{\"token\":\"" + token + "\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.emailVerified").value(true));
        String auth = "Bearer " + mapper.readTree(body).get("token").asText();
        mvc.perform(get("/api/me").header("Authorization", auth)).andExpect(jsonPath("$.emailVerified").value(true));
    }

    private String registerWithEmail(String name, String email) throws Exception {
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"" + name + "\",\"email\":\"" + email + "\",\"password\":\"motdepasse1\",\"region\":\"centre\"}"))
                .andExpect(status().isCreated());
        return email;
    }

    private String forgot(String email) throws Exception {
        mvc.perform(post("/api/auth/password/forgot").contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"" + email + "\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("Si un compte")));
        return find(lastMail(email), "letter-spacing:10px[^>]*>([0-9]{6})<");
    }

    private org.springframework.test.web.servlet.ResultActions verify(String email, String code) throws Exception {
        return mvc.perform(post("/api/auth/password/verify").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"code\":\"" + code + "\"}"));
    }

    @Test
    void motDePasseOublieAvecCodeAUsageUnique() throws Exception {
        String email = registerWithEmail("Nafi", UUID.randomUUID() + "@test.bf");
        // réponse identique pour une adresse inconnue
        mvc.perform(post("/api/auth/password/forgot").contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"personne@test.bf\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("Si un compte")));

        String code = forgot(email);
        String wrong = code.equals("000000") ? "111111" : "000000";
        verify(email, wrong).andExpect(status().isBadRequest());
        verify(email, "12ab").andExpect(status().isBadRequest());
        String body = verify(email, code).andExpect(status().isOk()).andExpect(jsonPath("$.resetToken").exists())
                .andReturn().getResponse().getContentAsString();
        String resetToken = mapper.readTree(body).get("resetToken").asText();
        // code déjà utilisé
        verify(email, code).andExpect(status().isBadRequest());

        mvc.perform(post("/api/auth/password/reset").contentType(MediaType.APPLICATION_JSON)
                .content("{\"resetToken\":\"" + resetToken + "\",\"password\":\"court\"}")).andExpect(status().isBadRequest());
        mvc.perform(post("/api/auth/password/reset").contentType(MediaType.APPLICATION_JSON)
                .content("{\"resetToken\":\"" + resetToken + "\",\"password\":\"nouveauMdp42\"}")).andExpect(status().isOk());
        // jeton consommé
        mvc.perform(post("/api/auth/password/reset").contentType(MediaType.APPLICATION_JSON)
                .content("{\"resetToken\":\"" + resetToken + "\",\"password\":\"autreMdp42\"}")).andExpect(status().isBadRequest());

        login(email, "nouveauMdp42");
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"motdepasse1\"}")).andExpect(status().isUnauthorized());
    }

    @Test
    void codeExpireOuTropDEssaisEstRefuse() throws Exception {
        String email = registerWithEmail("Bintou", UUID.randomUUID() + "@test.bf");
        String code = forgot(email);
        long userId = users.findByEmailIgnoreCase(email).orElseThrow().getId();
        PasswordReset r = resets.findFirstByUserIdOrderByCreatedAtDesc(userId).orElseThrow();
        r.setExpiresAt(Instant.now().minusSeconds(1));
        resets.save(r);
        verify(email, code).andExpect(status().isBadRequest());

        String other = registerWithEmail("Kadi", UUID.randomUUID() + "@test.bf");
        String good = forgot(other);
        String wrong = good.equals("000000") ? "111111" : "000000";
        for (int i = 0; i < 5; i++) verify(other, wrong).andExpect(status().isBadRequest());
        verify(other, good).andExpect(status().isBadRequest()); // bloqué après 5 essais
    }

    @Test
    void nouveauRecitValideDevientUnConte() throws Exception {
        String user = register("Hamidou");
        String data = """
                {"kind":"story","title":"La calebasse du génie","region":"liptako","language":"fr","taleType":"conte",
                 "text":"Il était une fois une calebasse qui ne se vidait jamais.\\n\\nUn génie l'avait offerte à une veuve généreuse qui partageait tout.","consent":true}""";
        String body = mvc.perform(multipart("/api/contributions").file(new MockMultipartFile("data", "", "application/json", data.getBytes()))
                        .header("Authorization", user))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        long id = mapper.readTree(body).get("id").asLong();

        String approved = mvc.perform(post("/api/admin/contributions/" + id + "/approve").header("Authorization", login("admin@kibare.bf", "kibare2026")))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String slug = mapper.readTree(approved).get("publishedSlug").asText();
        mvc.perform(get("/api/tales/" + slug)).andExpect(status().isOk())
                .andExpect(jsonPath("$.contributors[0].name").value("Hamidou"))
                .andExpect(jsonPath("$.scenes", hasSize(2)));
    }

    @Test
    void changementDeMotDePasseDepuisLeCompte() throws Exception {
        String email = registerWithEmail("Ousmane", UUID.randomUUID() + "@test.bf");
        String auth = login(email, "motdepasse1");
        mvc.perform(get("/api/me").header("Authorization", auth)).andExpect(jsonPath("$.hasPassword").value(true));
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/api/me/password").header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON).content("{\"currentPassword\":\"faux\",\"newPassword\":\"nouveau123\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/api/me/password").header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON).content("{\"currentPassword\":\"motdepasse1\",\"newPassword\":\"nouveau123\"}"))
                .andExpect(status().isOk());
        login(email, "nouveau123");
    }

    @Test
    void connexionGoogleNonConfigureeEstRefusee() throws Exception {
        mvc.perform(get("/api/auth/google/config")).andExpect(status().isOk()).andExpect(jsonPath("$.enabled").value(false));
        mvc.perform(post("/api/auth/google").contentType(MediaType.APPLICATION_JSON).content("{\"credential\":\"faux.jeton.google\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void commentairesEtReponses() throws Exception {
        String a = register("Ali");
        String b = register("Fanta");
        String c1 = mvc.perform(post("/api/tales/yennenga/comments").header("Authorization", a).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"text\":\"Magnifique légende !\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        long id = mapper.readTree(c1).get("id").asLong();
        mvc.perform(post("/api/tales/yennenga/comments").header("Authorization", b).contentType(MediaType.APPLICATION_JSON)
                .content("{\"text\":\"Je suis d'accord\",\"parentId\":" + id + "}")).andExpect(status().isCreated());
        mvc.perform(get("/api/tales/yennenga/comments")).andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(2))));
        mvc.perform(get("/api/me/notifications").header("Authorization", a)).andExpect(jsonPath("$[0].type").value("COMMENT_REPLY"));
        mvc.perform(post("/api/tales/yennenga/comments").contentType(MediaType.APPLICATION_JSON).content("{\"text\":\"anonyme\"}"))
                .andExpect(status().isUnauthorized());
    }
}
