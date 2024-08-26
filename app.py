from flask import Flask, request, jsonify, render_template
import sqlite3
import uuid
import json

app = Flask(__name__)

# Endpoints da API

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/create_room', methods=['POST'])
def create_room():
    conn = sqlite3.connect('webrtc.db')
    cursor = conn.cursor()
    room_id = str(uuid.uuid4())
    offer_sdp = request.json['offer']['sdp']
    cursor.execute('INSERT INTO rooms (room_id, offer_sdp) VALUES (?, ?)', (room_id, offer_sdp))
    conn.commit()
    conn.close()
    return jsonify({'room_id': room_id})

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

if __name__ == '__main__':
    app.run(debug=True)
