from flask import Flask, request, jsonify, render_template
import sqlite3
import uuid
import logging


app = Flask(__name__)

# Configuração do logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Endpoints da API

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/create_room', methods=['POST'])
def create_room():
    conn = sqlite3.connect('webrtc.db')
    cursor = conn.cursor()

    room_id = str(uuid.uuid4())
    offer_sdp = request.json['offer']  # Recebe a oferta do cliente

    cursor.execute('INSERT INTO rooms (room_id, offer_sdp) VALUES (?, ?)', (room_id, offer_sdp))
    conn.commit()
    conn.close()

    return jsonify({'room_id': room_id}), 200

@app.route('/join_room/<room_id>', methods=['GET'])
def join_room(room_id):
    conn = sqlite3.connect('webrtc.db')
    cursor = conn.cursor()
    cursor.execute('SELECT offer_sdp FROM rooms WHERE room_id = ?', (room_id,))
    room = cursor.fetchone()
    conn.close()
    if room:
        return jsonify({'offer': {'type': 'offer', 'sdp': room[0]}})
    else:
        return jsonify({'error': 'Room not found'}), 404

@app.route('/add_answer/<room_id>', methods=['POST'])
def add_answer(room_id):
    conn = sqlite3.connect('webrtc.db')
    cursor = conn.cursor()
    answer_sdp = request.json['answer']['sdp']
    cursor.execute('UPDATE rooms SET answer_sdp = ? WHERE room_id = ?', (answer_sdp, room_id))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/add_candidate/<room_id>', methods=['POST'])
def add_candidate(room_id):
    conn = sqlite3.connect('webrtc.db')
    cursor = conn.cursor()
    candidate = request.json['candidate']
    candidate_type = request.json['type']
    cursor.execute('INSERT INTO candidates (room_id, candidate, type) VALUES (?, ?, ?)', (room_id, candidate, candidate_type))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/get_candidates/<room_id>/<type>', methods=['GET'])
def get_candidates(room_id, type):
    conn = sqlite3.connect('webrtc.db')
    cursor = conn.cursor()
    cursor.execute('SELECT candidate FROM candidates WHERE room_id = ? AND type = ?', (room_id, type))
    candidates = [row[0] for row in cursor.fetchall()]
    conn.close()
    return jsonify({'candidates': candidates})

@app.route('/delete_room/<room_id>', methods=['DELETE'])
def delete_room(room_id):
    conn = sqlite3.connect('webrtc.db')
    cursor = conn.cursor()
    cursor.execute('DELETE FROM rooms WHERE room_id = ?', (room_id,))
    cursor.execute('DELETE FROM candidates WHERE room_id = ?', (room_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/save_answer/<room_id>', methods=['POST'])
def save_answer(room_id):
    conn = sqlite3.connect('webrtc.db')
    cursor = conn.cursor()
    offer_sdp = request.json['sdp']
    cursor.execute('UPDATE rooms SET answer_sdp = ? WHERE room_id = ?', (offer_sdp, room_id))
    conn.commit()
    conn.close()
    return '', 204

@app.route('/save_ice_candidate/<room_id>/<role>', methods=['POST'])
def save_ice_candidate(room_id, role):
    conn = sqlite3.connect('webrtc.db')
    cursor = conn.cursor()

    candidate = request.json.get('candidate')
    candidate_json = str(candidate)  # Converte o dict para string

    if role == 'caller':
        cursor.execute('INSERT INTO caller_ice_candidates (room_id, candidate) VALUES (?, ?)',
                       (room_id, candidate_json))
    elif role == 'callee':
        cursor.execute('INSERT INTO callee_ice_candidates (room_id, candidate) VALUES (?, ?)',
                       (room_id, candidate_json))
    else:
        return jsonify({"error": "Invalid role"}), 400

    conn.commit()
    conn.close()
    return '', 204

@app.route('/get_ice_candidates/<room_id>/<role>', methods=['GET'])
def get_ice_candidates(room_id, role):
    conn = sqlite3.connect('webrtc.db')
    cursor = conn.cursor()

    if role == 'caller':
        cursor.execute('SELECT candidate FROM caller_ice_candidates WHERE room_id = ?', (room_id,))
    elif role == 'callee':
        cursor.execute('SELECT candidate FROM callee_ice_candidates WHERE room_id = ?', (room_id,))

    candidates = [row[0] for row in cursor.fetchall()]
    conn.close()

    return jsonify(candidates)

@app.route('/get_room/<room_id>', methods=['GET'])
def get_room(room_id):
    conn = sqlite3.connect('webrtc.db')
    cursor = conn.cursor()

    cursor.execute('SELECT offer_sdp FROM rooms WHERE room_id = ?', (room_id,))
    result = cursor.fetchone()

    if result:
        offer_sdp = result[0]
        conn.close()
        return jsonify({'offer': offer_sdp}), 200
    else:
        conn.close()
        return jsonify({'error': 'Room not found'}), 404

@app.route('/get_answer/<room_id>', methods=['GET'])
def get_answer(room_id):
    conn = sqlite3.connect('webrtc.db')
    cursor = conn.cursor()

    cursor.execute('SELECT answer_sdp FROM rooms WHERE room_id = ?', (room_id,))
    result = cursor.fetchone()

    if result:
        answer_sdp = result[0]
        conn.close()
        return jsonify({'sdp': answer_sdp}), 200
    else:
        conn.close()
        return jsonify({'error': 'Room not found'}), 404

if __name__ == '__main__':
    logger.info("Starting Flask server...")
    # Rodar o servidor Flask com HTTPS
    try:
        app.run(host='10.10.0.18' ,ssl_context=('cert.pem', 'key.pem'))
    except Exception as e:
        print(f"Error starting server: {e}")


