# Simple E2E test: create teacher, room, quiz, student join, start and submit attempt
$base = 'http://localhost:4000/api'
Write-Output "== Starting automated quiz flow test =="

function SafeInvoke($method,$uri,$headers,$body){
  try{
    if ($body) { return Invoke-RestMethod -Method $method -Uri $uri -Headers $headers -ContentType 'application/json' -Body ($body | ConvertTo-Json -Depth 12) }
    else { return Invoke-RestMethod -Method $method -Uri $uri -Headers $headers }
  } catch {
    $resp = $_.Exception.Response
    if ($resp) {
      try {
        if ($resp.Content -ne $null) {
          $txt = $resp.Content.ReadAsStringAsync().Result
          Write-Output "ERROR: $txt"
        } else {
          Write-Output "ERROR: Response object present but no Content: $($_.Exception.Message)"
        }
      } catch {
        Write-Output "ERROR reading response body: $($_.Exception.Message)"
      }
      return $null
    }
    Write-Output "ERROR: $($_.Exception.Message)"
    return $null
  }
}

# 1) Register teacher
$tbody = @{ name='Auto Teacher'; email='teacher_test+auto@example.com'; password='testpass1'; role='teacher' }
$treg = SafeInvoke 'Post' "$base/auth/register" $null $tbody
if ($treg) { Write-Output "Teacher registered: $($treg | ConvertTo-Json -Depth 5)" } else { Write-Output "Teacher register likely exists or failed." }

# 2) Login teacher
$tlogin = SafeInvoke 'Post' "$base/auth/login" $null @{ email='teacher_test+auto@example.com'; password='testpass1' }
if (-not $tlogin) { Write-Output "Teacher login failed; aborting."; exit 1 }
$teacherToken = $tlogin.session.access_token
Write-Output "Teacher login token acquired."
$hdrT = @{ Authorization = "Bearer $teacherToken" }

# 3) Create room
$roomBody = @{ name='AutoRoom'; description='Room created by automated test'; subject='Math'; maxStudents=10; allowSelfJoin=$true; requireApproval=$false }
$room = SafeInvoke 'Post' "$base/rooms" $hdrT $roomBody
if (-not $room) { Write-Output "Failed to create room"; exit 1 }
Write-Output "Room created: $($room | ConvertTo-Json -Depth 5)"
$roomId = $room.room.id; $roomCode = $room.room.code
Write-Output "roomId: $roomId, roomCode: $roomCode"

# 4) Create quiz
$questionId = [guid]::NewGuid().ToString()
$quizBody = @{ title='Auto Quiz 1'; description=''; timeLimit=10; scheduledStart=''; scheduledEnd=''; attemptsAllowed=1; shuffleQuestions=$false; shuffleOptions=$false; questions=@(@{ id=$questionId; question='2 + 2 = ?'; type='multiple-choice'; options=@('1','2','3','4'); correctAnswer=3; points=10; sampleAnswer=''; courseOutcome=''; bloomsTaxonomy='' }) }
$quiz = SafeInvoke 'Post' "$base/quizzes/rooms/$roomId" $hdrT $quizBody
if (-not $quiz) { Write-Output "Failed to create quiz"; exit 1 }
Write-Output "Quiz created: $($quiz | ConvertTo-Json -Depth 12)"
$quizId = $quiz.quiz.id

# 5) Register student
$sbody = @{ name='Auto Student'; email='student_test+auto@example.com'; password='testpass1'; role='student' }
$sreg = SafeInvoke 'Post' "$base/auth/register" $null $sbody
if ($sreg) { Write-Output "Student registered." } else { Write-Output "Student register likely exists or failed." }

# 6) Login student
$slogin = SafeInvoke 'Post' "$base/auth/login" $null @{ email='student_test+auto@example.com'; password='testpass1' }
if (-not $slogin) { Write-Output "Student login failed; aborting."; exit 1 }
$studentToken = $slogin.session.access_token
Write-Output "Student login token acquired."
$hdrS = @{ Authorization = "Bearer $studentToken" }

# 7) Student join room by code
$joinBody = @{ code = $roomCode }
$join = SafeInvoke 'Post' "$base/rooms/join" $hdrS $joinBody
Write-Output "Join response: $($join | ConvertTo-Json -Depth 8)"
if ($join -and $join.membership -and $join.membership.status -ne 'active') { Write-Output "Membership pending; approve via teacher UI and re-run."; exit 0 }

# 8) Start attempt
$startBody = @{ roomId = $roomId }
$start = SafeInvoke 'Post' "$base/quizzes/$quizId/attempts" $hdrS $startBody
if (-not $start) { Write-Output "Failed to start attempt"; exit 1 }
Write-Output "Start attempt response: $($start | ConvertTo-Json -Depth 8)"
$attemptId = $start.attempt.id

# 9) Submit attempt
$answers = @(@{ questionId = $questionId; response = 3 })
$submitBody = @{ answers=$answers; elapsedSeconds=7 }
$submit = SafeInvoke 'Post' "$base/quizzes/$quizId/attempts/$attemptId/submit" $hdrS $submitBody
if (-not $submit) { Write-Output "Submit failed"; exit 1 }
Write-Output "Submit response: $($submit | ConvertTo-Json -Depth 12)"
Write-Output "== Test finished =="
