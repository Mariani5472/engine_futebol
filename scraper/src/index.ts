import puppeteer, { HTTPResponse, Page } from "puppeteer";
import { mkdir, writeFile } from "node:fs/promises";

const STANDINGS_URL =
  "https://www.sofascore.com/pt/football/tournament/brazil/brasileirao-serie-a/325";

const STANDINGS_API =
  "/api/v1/unique-tournament/325/season/87678/standings/total";

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  await mkdir("data", { recursive: true });

  /**
   * Captura o JSON de uma resposta específica.
   */
  async function captureResponse(
    page: Page,
    urlPattern: string,
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        page.off("response", listener);

        reject(
          new Error(
            `Timeout esperando resposta: ${urlPattern}`,
          ),
        );
      }, 30000);

      const listener = async (response: HTTPResponse) => {
        if (!response.url().includes(urlPattern)) {
          return;
        }

        clearTimeout(timeout);
        page.off("response", listener);

        console.log("API encontrada!");
        console.log("status:", response.status());
        console.log("url:", response.url());

        try {
          const data = await response.json();

          resolve(data);
        } catch (error) {
          reject(error);
        }
      };

      page.on("response", listener);
    });
  }

  /**
   * 1. Busca standings.
   */
  console.log("Buscando classificação...");

  const standingsPromise = captureResponse(
    page,
    STANDINGS_API,
  );

  await page.goto(STANDINGS_URL, {
    waitUntil: "networkidle2",
  });

  const standings = await standingsPromise;

  console.log("Classificação encontrada.");

  /**
   * Extrai os times.
   */
  const standingsData = standings as {
    standings: Array<{
      rows: Array<{
        team: {
          id: number;
          name: string;
          slug: string;
        };
      }>;
    }>;
  };

  const rows = standingsData.standings[0].rows;

  console.log(`Times encontrados: ${rows.length}`);

  /**
   * 2. Para cada time, acessa sua página
   * e captura o endpoint de jogadores.
   */
  const teams = [];

  for (const row of rows) {
    const team = row.team;

    console.log(
      `\nBuscando elenco de ${team.name} (${team.id})...`,
    );

    const playersApi = `/api/v1/team/${team.id}/players`;

    try {
      const playersPromise = captureResponse(
        page,
        playersApi,
      );

      await page.goto(
        `https://www.sofascore.com/pt/football/team/${team.slug}/${team.id}#tab:players`,
        {
          waitUntil: "networkidle2",
        },
      );

      const players = await playersPromise;

      teams.push({
        team,
        players,
      });

      console.log(`Elenco de ${team.name} capturado.`);
    } catch (error) {
      console.error(
        `Erro ao buscar elenco de ${team.name}:`,
        error,
      );

      teams.push({
        team,
        players: null,
      });
    }
  }

  /**
   * 3. Salva tudo.
   */
  const result = {
    standings,
    teams,
  };

  await writeFile(
    "data/sofascore-brasileirao-2026.json",
    JSON.stringify(result, null, 2),
    "utf-8",
  );

  console.log(
    "\nDados salvos em: data/sofascore-brasileirao-2026.json",
  );

  await browser.close();
})()

