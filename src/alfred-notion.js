#!/usr/bin/env node

const https = require('https');

const spaceId = process.env.NOTION_SPACE_ID;
const cookie = process.env.NOTION_COOKIE;
const query = process.argv.slice(2).join(' ');

(async () => {
  const json = await search({ spaceId, cookie, query });

  const links = json.results.map(v => {
    const id = v.id;

    let block = json.recordMap.block[id].value;
    const title = block.properties.title[0];

    const parents = [];

    do {
      const { parent_id, parent_table } = block;
      if (parent_table === 'space') {
        break;
      }
      if (parent_table === 'collection') {
        block = json.recordMap.collection[parent_id].value;
        parents.push(block.name[0]);
      } else if (parent_table === 'block') {
        block = json.recordMap.block[parent_id].value;
        if (block.type === 'page') {
          parents.push(block.properties.title[0]);
        }
      }
    } while (true);
    return {
      id: id.replaceAll('-', ''),
      title,
      parents,
    };
  });

  const items = links.map(v => {
    return {
      uid: v.id,
      type: 'default',
      title: v.title.join(' '),
      subtitle: v.parents.reverse().join(' / '),
      arg: v.id,
      text: {
        // use cmd+c to copy this text
        copy: `https://notion.so/${v.id}`,
        // use cmd+L to display this text
        largetype: JSON.stringify(v, null, 4),
      },
      mods: {
        cmd: {
          valid: true,
          arg: `https://notion.so/${v.id}`,
          subtitle: 'Open in Notion',
        },
      },
    };
  });

  console.log(JSON.stringify({ items }));
})();

async function search({ spaceId, cookie, query }) {
  const data = JSON.stringify({
    type: 'BlocksInSpace',
    query,
    spaceId,
    limit: 20,
    filters: {
      isDeletedOnly: false,
      excludeTemplates: false,
      navigableBlockContentOnly: false,
      requireEditPermissions: false,
      includePublicPagesWithoutExplicitAccess: false,
      ancestors: [],
      createdBy: [],
      editedBy: [],
      lastEditedTime: {},
      createdTime: {},
      inTeams: [],
    },
    sort: {
      field: 'relevance',
    },
    source: 'quick_find_input_change',
    searchExperimentOverrides: {},
    searchSessionFlowNumber: 2,
  });

  const options = {
    hostname: 'www.notion.so',
    path: '/api/v3/search',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
      'Notion-Version': '2022-06-28',
    },
  };
  return await new Promise(resolve => {
    const req = https.request(options, res => {
      res.setEncoding('utf-8');
      let data = '';
      res.on('data', chunk => {
        data += chunk;
      });
      res.on('end', () => {
        resolve(JSON.parse(data));
      });
    });

    req.write(data);
    req.end();
  });
}
