import sqlite3
import json
import os
from typing import List, Dict, Any

DB_PATH = os.path.join(os.path.dirname(__file__), "simulations.sqlite")

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_connection() as conn:
         conn.execute("""
            CREATE TABLE IF NOT EXISTS simulations (
                id TEXT PRIMARY KEY,
                scenario TEXT,
                platform TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                decision TEXT,
                summary TEXT,
                report_analytics TEXT,
                graph_json TEXT,
                feed_json TEXT,
                agents_json TEXT
            )
         """)

def save_simulation(sim_id: str, scenario: str, platform: str, decision: str, summary: str, report_analytics: dict, graph: dict, feed: list, agents: list):
    with get_connection() as conn:
        conn.execute("""
            INSERT OR REPLACE INTO simulations (id, scenario, platform, decision, summary, report_analytics, graph_json, feed_json, agents_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            sim_id, scenario, platform, decision, summary, 
            json.dumps(report_analytics) if report_analytics else None,
            json.dumps(graph) if graph else None,
            json.dumps(feed) if feed else '[]',
            json.dumps(agents) if agents else '[]'
        ))

def get_simulations() -> List[Dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute("SELECT id, scenario, platform, timestamp, decision FROM simulations ORDER BY timestamp DESC").fetchall()
        return [dict(r) for r in rows]

def get_simulation(sim_id: str) -> Dict[str, Any]:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM simulations WHERE id = ?", (sim_id,)).fetchone()
        if row:
            d = dict(row)
            d['report_analytics'] = json.loads(d['report_analytics']) if d.get('report_analytics') else None
            d['graph'] = json.loads(d['graph_json']) if d.get('graph_json') else None
            d['feed'] = json.loads(d['feed_json']) if d.get('feed_json') else []
            d['agents'] = json.loads(d['agents_json']) if d.get('agents_json') else []
            return d
        return None
