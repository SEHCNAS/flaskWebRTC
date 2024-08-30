import sqlite3

# Conectar ao banco de dados (ou criar se não existir)
conn = sqlite3.connect('webrtc.db')
cursor = conn.cursor()

# Criar a tabela de salas
cursor.execute('''
CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT UNIQUE NOT NULL,
    offer_sdp TEXT,
    answer_sdp TEXT
)
''')

# Criar a tabela de candidatos ICE
cursor.execute('''
CREATE TABLE IF NOT EXISTS candidates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT NOT NULL,
    candidate TEXT NOT NULL,
    type TEXT NOT NULL,  -- 'caller' ou 'callee'
    FOREIGN KEY(room_id) REFERENCES rooms(room_id)
)
''')

cursor.execute('''
        CREATE TABLE IF NOT EXISTS caller_ice_candidates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_id TEXT NOT NULL,
            candidate TEXT NOT NULL
        )
    ''')

cursor.execute('''
        CREATE TABLE IF NOT EXISTS callee_ice_candidates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_id TEXT NOT NULL,
            candidate TEXT NOT NULL
        )
    ''')

# Confirmar a criação das tabelas
conn.commit()

# Fechar a conexão com o banco de dados
conn.close()

print("Banco de dados e tabelas criados com sucesso.")
