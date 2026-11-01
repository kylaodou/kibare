package bf.yaaba;

import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:kibare-test",
        "yaaba.storage-dir=target/test-uploads"})
@AutoConfigureMockMvc
class YaabaApiTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;

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
        mvc.perform(get("/api/regions")).andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(13)));
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
                 "region":"centre-ouest","language":"moore","consent":true}""";
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
                {"kind":"voice","taleSlug":"yennenga","title":"Yennenga","region":"centre-est","language":"moore","consent":true}""";
        String body = mvc.perform(multipart("/api/contributions")
                        .file(new MockMultipartFile("data", "", "application/json", data.getBytes()))
                        .file(new MockMultipartFile("segments", "paragraphe-1.webm", "audio/webm", new byte[] {1, 2}))
                        .file(new MockMultipartFile("segments", "paragraphe-2.webm", "audio/webm", new byte[] {3, 4}))
                        .header("Authorization", user))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.segments", hasSize(2)))
                .andReturn().getResponse().getContentAsString();
        long id = mapper.readTree(body).get("id").asLong();

        mvc.perform(post("/api/admin/contributions/" + id + "/approve").header("Authorization", login("admin@kibare.bf", "kibare2026")))
                .andExpect(status().isOk());
        String tracks = mvc.perform(get("/api/tales/yennenga/audio"))
                .andExpect(jsonPath("$[?(@.narrator == 'Rasmata')].segments[1]").exists())
                .andReturn().getResponse().getContentAsString();
        for (JsonNode t : mapper.readTree(tracks))
            if (t.get("narrator").asText().equals("Rasmata")) mvc.perform(get(t.get("segments").get(1).asText())).andExpect(status().isOk());
    }

    @Test
    void nouveauRecitValideDevientUnConte() throws Exception {
        String user = register("Hamidou");
        String data = """
                {"kind":"story","title":"La calebasse du génie","region":"sahel","language":"fr","taleType":"conte",
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
