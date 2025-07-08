import { Client } from "@notionhq/client";
import { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import dotenv from "dotenv";
dotenv.config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });

async function fetchKanbanTasks() {
  const response = await notion.databases.query({
    database_id: process.env.NOTION_DATABASE_ID!,
  });

  const tasks = response.results.map(page => {
    const props = (page as PageObjectResponse).properties;

    const title = props["Name"]?.type === "title"
      ? (props["Name"].title[0]?.type === "text" ? props["Name"].title[0].text?.content : "Untitled") ?? "Untitled"
      : "Untitled";

    const status = props["Status"]?.type === "select"
      ? props["Status"].select?.name ?? "Unknown"
      : "Unknown";

    return { title, status };
  });

  console.log(tasks);
}

fetchKanbanTasks();

