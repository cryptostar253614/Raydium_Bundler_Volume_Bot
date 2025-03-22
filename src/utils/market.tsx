export async function get_market(market_key: string) {
  try {
    const response = await fetch("/api/market", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marketKey: market_key }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error || `HTTP error! Status: ${response.status}`
      );
    }
    const data = await response.json();
    console.log("Market Keys:", data);

    return data;
  } catch (error) {
    console.error("Error fetching market keys:", error);
    return null;
  }
}
