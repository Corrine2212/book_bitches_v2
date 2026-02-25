// netlify/functions/cover.js
// Secure proxy for the Hardcover API.
// The HARDCOVER_TOKEN environment variable is set in Netlify's dashboard —
// it never touches the browser or any file in your repo.

exports.handler = async (event) => {
  const { title, author } = event.queryStringParameters || {};

  if (!title || !author) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing title or author' })
    };
  }

  const token = process.env.HARDCOVER_TOKEN;
  if (!token) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Hardcover token not configured' })
    };
  }

  const query = `query SearchBooks($query: String!) {
    search(query: $query, query_type: "Book", per_page: 5) {
      results {
        ... on Book {
          title
          contributions { author { name } }
          image { url }
        }
      }
    }
  }`;

  try {
    const res = await fetch('https://api.hardcover.app/v1/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token
      },
      body: JSON.stringify({
        query,
        variables: { query: `${title} ${author}` }
      })
    });

    if (!res.ok) {
      return { statusCode: res.status, body: JSON.stringify({ error: 'Hardcover request failed' }) };
    }

    const data = await res.json();
    const results = data?.data?.search?.results || [];

    for (const book of results) {
      const imgUrl = book?.image?.url;
      if (imgUrl) {
        const url = imgUrl.replace('/s/', '/l/').replace('_SX98_', '_SX400_');
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' },
          body: JSON.stringify({ url })
        };
      }
    }

    // No cover found
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: null })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
