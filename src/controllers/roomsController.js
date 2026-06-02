const { query } = require('../config/db');
const HttpError = require('../utils/httpError');
const { generateRoomCode } = require('../utils/generateRoomCode');

async function ensureUniqueRoomCode() {
  for (let i = 0; i < 8; i += 1) {
    const code = generateRoomCode();
    const rows = await query('SELECT id FROM rooms WHERE code = ? LIMIT 1', [code]);
    if (!rows || rows.length === 0) {
      return code;
    }
  }
  throw new HttpError(500, 'Unable to generate unique room code');
}

function mapRoom(room, memberStats = [], quizStats = []) {
  const stats = memberStats.find((stat) => stat.room_id === room.id) || { total: 0, active: 0 };
  const quizCount = quizStats.find((stat) => stat.room_id === room.id)?.count || 0;
  return {
    id: room.id,
    name: room.name,
    description: room.description,
    subject: room.subject,
    code: room.code,
    teacherId: room.teacher_id,
    teacherName: room.teacher_name || room.teacherName || null,
    maxStudents: room.max_students,
    allowSelfJoin: room.allow_self_join,
    requireApproval: room.require_approval,
    createdAt: room.created_at,
    updatedAt: room.updated_at,
    studentCount: stats.active,
    quizCount,
    totalMembers: stats.total
  };
}

async function getMemberStats(roomIds) {
  if (!roomIds.length) return [];

  const placeholders = roomIds.map(() => '?').join(',');
  const rows = await query(
    `SELECT room_id, status FROM room_members WHERE room_id IN (${placeholders})`,
    roomIds
  );

  return roomIds.map((roomId) => {
    const members = rows.filter((member) => member.room_id === roomId);
    return {
      room_id: roomId,
      total: members.length,
      active: members.filter((member) => member.status === 'active').length
    };
  });
}

async function getQuizStats(roomIds) {
  if (!roomIds.length) return [];

  const placeholders = roomIds.map(() => '?').join(',');
  const rows = await query(`SELECT room_id FROM quizzes WHERE room_id IN (${placeholders})`, roomIds);

  return roomIds.map((roomId) => ({
    room_id: roomId,
    count: rows.filter((quiz) => quiz.room_id === roomId).length
  }));
}

async function listRooms(req, res, next) {
  try {
    if (req.user.role === 'teacher') {
      const rooms = await query('SELECT * FROM rooms WHERE teacher_id = ? ORDER BY created_at DESC', [req.user.id]);
      const roomIds = rooms.map((r) => r.id);
      const [memberStats, quizStats] = await Promise.all([getMemberStats(roomIds), getQuizStats(roomIds)]);
      return res.json({
        status: 'success',
        rooms: rooms.map((room) => mapRoom(room, memberStats, quizStats))
      });
    }

    const memberships = await query(
      `SELECT rm.id, rm.status, rm.joined_at, r.id as room_id, r.name, r.description, r.subject, r.code, r.max_students, r.allow_self_join, r.require_approval, r.created_at, r.updated_at, r.teacher_id, u.name as teacher_name
       FROM room_members rm
       JOIN rooms r ON r.id = rm.room_id
       LEFT JOIN users u ON u.id = r.teacher_id
       WHERE rm.student_id = ?`,
      [req.user.id]
    );

    const joinedRooms = memberships.filter((m) => m.room_id);
    const roomIds = joinedRooms.map((record) => record.room_id);
    const [memberStats, quizStats] = await Promise.all([getMemberStats(roomIds), getQuizStats(roomIds)]);

    return res.json({
      status: 'success',
      rooms: joinedRooms.map((record) => ({
        ...mapRoom(
          {
            id: record.room_id,
            name: record.name,
            description: record.description,
            subject: record.subject,
            code: record.code,
            max_students: record.max_students,
            allow_self_join: record.allow_self_join,
            require_approval: record.require_approval,
            created_at: record.created_at,
            updated_at: record.updated_at,
            teacher_id: record.teacher_id,
            teacher_name: record.teacher_name
          },
          memberStats,
          quizStats
        ),
        membershipId: record.id,
        membershipStatus: record.status,
        joinedAt: record.joined_at
      }))
    });
  } catch (error) {
    return next(error);
  }
}

async function createRoom(req, res, next) {
  try {
    const code = await ensureUniqueRoomCode();

    const payload = {
      name: req.body.name,
      description: req.body.description || null,
      subject: req.body.subject || null,
      max_students: req.body.maxStudents,
      allow_self_join: req.body.allowSelfJoin,
      require_approval: req.body.requireApproval,
      code,
      teacher_id: req.user.id
    };

    const result = await query(
      'INSERT INTO rooms (name, description, subject, max_students, allow_self_join, require_approval, code, teacher_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())',
      [payload.name, payload.description, payload.subject, payload.max_students, payload.allow_self_join, payload.require_approval, payload.code, payload.teacher_id]
    );

    const [inserted] = await query('SELECT * FROM rooms WHERE id = ? LIMIT 1', [result.insertId]);

    return res.status(201).json({ status: 'success', room: mapRoom(inserted) });
  } catch (error) {
    return next(error);
  }
}

async function getRoom(req, res, next) {
  const { roomId } = req.params;

  try {
    const rows = await query(
      `SELECT r.*, u.name as teacher_name
       FROM rooms r
       LEFT JOIN users u ON u.id = r.teacher_id
       WHERE r.id = ? LIMIT 1`,
      [roomId]
    );
    const room = rows[0];
    if (!room) throw new HttpError(404, 'Room not found');

    if (req.user.role === 'teacher') {
      if (room.teacher_id !== req.user.id) throw new HttpError(403, 'Forbidden');
    } else {
      const membershipRows = await query('SELECT id FROM room_members WHERE room_id = ? AND student_id = ? AND status = ? LIMIT 1', [roomId, req.user.id, 'active']);
      if (!membershipRows || membershipRows.length === 0) throw new HttpError(403, 'You do not belong to this room');
    }

    const members = await query('SELECT id, student_id, student_name, student_email, status, joined_at FROM room_members WHERE room_id = ? ORDER BY joined_at DESC', [roomId]);

    const quizCountRows = await query('SELECT COUNT(id) as count FROM quizzes WHERE room_id = ?', [roomId]);
    const quizCount = quizCountRows[0]?.count || 0;

    const memberStats = [
      {
        room_id: room.id,
        total: members.length,
        active: members.filter((member) => member.status === 'active').length
      }
    ];

    const quizStats = [{ room_id: room.id, count: quizCount }];

    return res.json({ status: 'success', room: mapRoom(room, memberStats, quizStats), members });
  } catch (error) {
    return next(error);
  }
}

async function getRoomByCode(req, res, next) {
  const { code } = req.params;
  const normalizedCode = code.trim().toUpperCase();

  try {
    const rows = await query(
      `SELECT r.*, u.name as teacher_name
       FROM rooms r
       LEFT JOIN users u ON u.id = r.teacher_id
       WHERE UPPER(r.code) = ? LIMIT 1`,
      [normalizedCode]
    );
    const room = rows[0];
    if (!room) throw new HttpError(404, 'Room not found');

    if (req.user.role === 'teacher') {
      if (room.teacher_id !== req.user.id) throw new HttpError(403, 'Forbidden');
    } else {
      const membershipRows = await query('SELECT id FROM room_members WHERE room_id = ? AND student_id = ? AND status = ? LIMIT 1', [room.id, req.user.id, 'active']);
      if (!membershipRows || membershipRows.length === 0) throw new HttpError(403, 'You do not belong to this room');
    }

    const members = await query('SELECT id, student_id, student_name, student_email, status, joined_at FROM room_members WHERE room_id = ? ORDER BY joined_at DESC', [room.id]);

    const quizCountRows = await query('SELECT COUNT(id) as count FROM quizzes WHERE room_id = ?', [room.id]);
    const quizCount = quizCountRows[0]?.count || 0;

    const memberStats = [
      {
        room_id: room.id,
        total: members.length,
        active: members.filter((member) => member.status === 'active').length
      }
    ];

    const quizStats = [{ room_id: room.id, count: quizCount }];

    return res.json({ status: 'success', room: mapRoom(room, memberStats, quizStats), members });
  } catch (error) {
    return next(error);
  }
}

async function updateRoom(req, res, next) {
  const { roomId } = req.params;

  try {
    const existingRows = await query('SELECT teacher_id FROM rooms WHERE id = ? LIMIT 1', [roomId]);
    const existing = existingRows[0];
    if (!existing) throw new HttpError(404, 'Room not found');
    if (existing.teacher_id !== req.user.id) throw new HttpError(403, 'Forbidden');

    const updates = {
      name: req.body.name,
      description: req.body.description || null,
      subject: req.body.subject || null,
      max_students: req.body.maxStudents,
      allow_self_join: req.body.allowSelfJoin,
      require_approval: req.body.requireApproval,
      updated_at: new Date()
    };

    await query(
      'UPDATE rooms SET name = ?, description = ?, subject = ?, max_students = ?, allow_self_join = ?, require_approval = ?, updated_at = ? WHERE id = ?',
      [updates.name, updates.description, updates.subject, updates.max_students, updates.allow_self_join, updates.require_approval, updates.updated_at, roomId]
    );

    const [updated] = await query('SELECT * FROM rooms WHERE id = ? LIMIT 1', [roomId]);
    return res.json({ status: 'success', room: mapRoom(updated) });
  } catch (error) {
    return next(error);
  }
}

async function deleteRoom(req, res, next) {
  const { roomId } = req.params;

  try {
    const rows = await query('SELECT teacher_id FROM rooms WHERE id = ? LIMIT 1', [roomId]);
    const room = rows[0];
    if (!room) throw new HttpError(404, 'Room not found');
    if (room.teacher_id !== req.user.id) throw new HttpError(403, 'Forbidden');

    await query('DELETE FROM quiz_attempts WHERE room_id = ?', [roomId]);
    await query('DELETE FROM room_members WHERE room_id = ?', [roomId]);
    await query('DELETE FROM quizzes WHERE room_id = ?', [roomId]);
    await query('DELETE FROM rooms WHERE id = ?', [roomId]);

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

async function joinRoom(req, res, next) {
  const normalizedCode = req.body.code.trim().toUpperCase();

  try {
    const rows = await query('SELECT * FROM rooms WHERE UPPER(code) = ? LIMIT 1', [normalizedCode.toUpperCase()]);
    const room = rows[0];
    if (!room) throw new HttpError(404, 'Room not found');
    if (!room.allow_self_join) throw new HttpError(400, 'This room requires the teacher to add you manually');

    const activeCountRows = await query('SELECT COUNT(id) as count FROM room_members WHERE room_id = ? AND status = ?', [room.id, 'active']);
    const activeCount = activeCountRows[0]?.count || 0;
    if (activeCount >= room.max_students) throw new HttpError(400, 'Room is full');

    const existing = await query('SELECT id, status FROM room_members WHERE room_id = ? AND student_id = ? LIMIT 1', [room.id, req.user.id]);
    if (existing && existing.length > 0) {
      throw new HttpError(400, `You already have a ${existing[0].status} membership for this room`);
    }

    const status = room.require_approval ? 'pending' : 'active';

    const payload = [room.id, req.user.id, req.user.name, req.user.email, status];
    const result = await query('INSERT INTO room_members (room_id, student_id, student_name, student_email, status, joined_at) VALUES (?, ?, ?, ?, ?, NOW())', payload);
    const [membership] = await query('SELECT * FROM room_members WHERE id = ? LIMIT 1', [result.insertId]);

    return res.status(201).json({ status: 'success', membership });
  } catch (error) {
    return next(error);
  }
}

async function updateMemberStatus(req, res, next, targetStatus) {
  const { roomId, memberId } = req.params;

  try {
    const rows = await query('SELECT teacher_id FROM rooms WHERE id = ? LIMIT 1', [roomId]);
    const room = rows[0];
    if (!room) throw new HttpError(404, 'Room not found');
    if (room.teacher_id !== req.user.id) throw new HttpError(403, 'Forbidden');

    await query('UPDATE room_members SET status = ? WHERE id = ? AND room_id = ?', [targetStatus, memberId, roomId]);
    const [member] = await query('SELECT * FROM room_members WHERE id = ? LIMIT 1', [memberId]);
    if (!member) throw new HttpError(404, 'Member not found');

    return res.json({ status: 'success', member });
  } catch (error) {
    return next(error);
  }
}

function approveMember(req, res, next) {
  return updateMemberStatus(req, res, next, 'active');
}

function rejectMember(req, res, next) {
  return updateMemberStatus(req, res, next, 'rejected');
}

module.exports = {
  listRooms,
  createRoom,
  getRoom,
  getRoomByCode,
  updateRoom,
  deleteRoom,
  joinRoom,
  approveMember,
  rejectMember
};

