const ADMIN_PASSWORD = 'admin123';
let records = [];
let isAdmin = false;

// ---------- ЗАГРУЗКА ДАННЫХ ИЗ FIRESTORE ----------
function loadDataFromFirestore() {
    db.collection('records')
        .orderBy('rawDate', 'desc')
        .onSnapshot((snapshot) => {
            records = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                data.id = doc.id;
                records.push(data);
            });
            renderAll();
        }, (error) => {
            console.error("Ошибка загрузки: ", error);
            alert('Не удалось загрузить данные. Проверьте интернет и настройки Firebase.');
        });
}

// ---------- ДОБАВЛЕНИЕ ЗАПИСИ ----------
function addRecord() {
    const wine = document.getElementById('wineSelect').value;
    const employee = document.getElementById('employeeSelect').value;
    const eventName = document.getElementById('eventInput').value.trim();
    const type = document.getElementById('typeSelect').value;
    const status = document.getElementById('statusSelect').value;
    const dateValue = document.getElementById('dateInput').value;

    if (!wine || !employee || !eventName) {
        alert('Заполните все поля: Винотека, Сотрудник, Мероприятие');
        return;
    }

    let displayDate;
    if (dateValue) {
        const parts = dateValue.split('-');
        displayDate = `${parts[2]}.${parts[1]}.${parts[0]}`;
    } else {
        displayDate = new Date().toLocaleDateString();
    }

    const newRecord = {
        wine,
        employee,
        event: eventName,
        type,
        status,
        date: displayDate,
        rawDate: dateValue || new Date().toISOString().split('T')[0],
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    db.collection('records').add(newRecord)
        .then(() => {
            document.getElementById('eventInput').value = '';
        })
        .catch((error) => {
            console.error("Ошибка добавления: ", error);
            alert('Не удалось сохранить запись.');
        });
}

// ---------- ИЗМЕНЕНИЕ СТАТУСА ----------
function changeStatus(index, newStatus) {
    const record = records[index];
    if (!record) return;
    db.collection('records').doc(record.id).update({ status: newStatus })
        .catch((error) => {
            console.error("Ошибка обновления статуса: ", error);
            alert('Не удалось изменить статус.');
        });
}

// ---------- УДАЛЕНИЕ (только админ) ----------
function deleteRecord(index) {
    if (!isAdmin) {
        document.getElementById('adminStatus').textContent = '❌ Требуется авторизация администратора!';
        return;
    }
    const record = records[index];
    if (!record) return;
    if (confirm('Удалить запись?')) {
        db.collection('records').doc(record.id).delete()
            .catch((error) => {
                console.error("Ошибка удаления: ", error);
                alert('Не удалось удалить запись.');
            });
    }
}

// ---------- ОТРИСОВКА SELECT'ОВ ----------
function renderSelects() {
    const wineSelect = document.getElementById('wineSelect');
    const empSelect = document.getElementById('employeeSelect');

    wineSelect.innerHTML = '<option value="">— выберите —</option>';
    WINERIES.forEach(w => {
        const opt = document.createElement('option');
        opt.value = w;
        opt.textContent = w;
        wineSelect.appendChild(opt);
    });

    wineSelect.addEventListener('change', function() {
        const selectedWine = this.value;
        empSelect.innerHTML = '<option value="">— выберите —</option>';
        if (selectedWine && EMPLOYEES[selectedWine]) {
            EMPLOYEES[selectedWine].forEach(emp => {
                const opt = document.createElement('option');
                opt.value = emp;
                opt.textContent = emp;
                empSelect.appendChild(opt);
            });
        }
    });

    const filterWine = document.getElementById('filterWine');
    filterWine.innerHTML = '<option value="__all">🌐 Все винотеки (территория)</option>';
    WINERIES.forEach(w => {
        const opt = document.createElement('option');
        opt.value = w;
        opt.textContent = w;
        filterWine.appendChild(opt);
    });
    filterWine.addEventListener('change', updateStats);
}

// ---------- ОБНОВЛЕНИЕ ТАБЛИЦЫ (ГЛАВНАЯ) ----------
function renderTable() {
    const tbody = document.getElementById('recordsBody');
    if (records.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center">Нет записей</td></tr>`;
        return;
    }

    let html = '';
    records.forEach((r, i) => {
        let badgeClass = 'badge-gray';
        if (r.status === 'Пройдено') badgeClass = 'badge-green';
        else if (r.status === 'Пропущено') badgeClass = 'badge-red';

        const reqInfo = getRequiredEventInfo(r.event);
        let reqCell = '';
        if (reqInfo.isRequired && r.status === 'Пройдено') {
            reqCell = `<span title="Для аттестации грейд ${reqInfo.grade}" style="cursor:help; color:#2d6a2d; font-size:18px;">✅</span>`;
        } else if (reqInfo.isRequired) {
            reqCell = `<span title="Для аттестации грейд ${reqInfo.grade}" style="cursor:help; color:#b13a3a; font-size:18px;">❌</span>`;
        } else {
            reqCell = '—';
        }

        const statusOptions = ['Пройдено', 'Запланировано', 'Пропущено'];
        let selectHtml = `<select class="status-select" onchange="changeStatus(${i}, this.value)">`;
        statusOptions.forEach(st => {
            selectHtml += `<option value="${st}" ${st === r.status ? 'selected' : ''}>${st}</option>`;
        });
        selectHtml += `</select>`;

        html += `<tr>
            <td>${r.wine}</td>
            <td>${r.employee}</td>
            <td>${r.event}</td>
            <td>${r.type}</td>
            <td><span class="badge ${badgeClass}">${r.status}</span></td>
            <td>${r.date || ''}</td>
            <td>${reqCell}</td>
            <td>${selectHtml}</td>
        </tr>`;
    });
    tbody.innerHTML = html;
}

// ---------- ТАБЛИЦА ДЛЯ АДМИНА ----------
function renderAdminTable() {
    const tbody = document.getElementById('adminRecordsBody');
    const wrap = document.getElementById('adminTableWrap');
    if (!isAdmin) {
        wrap.style.display = 'none';
        return;
    }
    wrap.style.display = 'block';

    if (records.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center">Нет записей</td></tr>`;
        return;
    }

    let html = '';
    records.forEach((r, i) => {
        let badgeClass = 'badge-gray';
        if (r.status === 'Пройдено') badgeClass = 'badge-green';
        else if (r.status === 'Пропущено') badgeClass = 'badge-red';

        html += `<tr>
            <td>${r.wine}</td>
            <td>${r.employee}</td>
            <td>${r.event}</td>
            <td>${r.type}</td>
            <td><span class="badge ${badgeClass}">${r.status}</span></td>
            <td>${r.date || ''}</td>
            <td><button class="btn btn-sm btn-danger" onclick="deleteRecord(${i})">🗑 Удалить</button></td>
        </tr>`;
    });
    tbody.innerHTML = html;
}

// ---------- СТАТИСТИКА ПО ТЕРРИТОРИИ ----------
function updateStats() {
    const filterValue = document.getElementById('filterWine').value;
    let filtered = [];
    if (filterValue === '__all') {
        filtered = records;
    } else {
        filtered = records.filter(r => r.wine === filterValue);
    }

    const total = filtered.length;
    const done = filtered.filter(r => r.status === 'Пройдено').length;
    const planned = filtered.filter(r => r.status === 'Запланировано').length;
    const missed = filtered.filter(r => r.status === 'Пропущено').length;
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);

    document.getElementById('stTotal').textContent = total;
    document.getElementById('stDone').textContent = done;
    document.getElementById('stPlanned').textContent = planned;
    document.getElementById('stMissed').textContent = missed;
    document.getElementById('stPercent').textContent = percent + '%';

    const detail = document.getElementById('statsDetail');
    if (filterValue === '__all') {
        detail.textContent = `📌 По территории МСК2: ${total} записей, ${percent}% выполнения.`;
    } else {
        const totalAll = records.length;
        const percentAll = totalAll === 0 ? 0 : Math.round((records.filter(r => r.status === 'Пройдено').length / totalAll) * 100);
        detail.textContent = `📌 Винотека «${filterValue}»: ${total} записей, ${percent}% выполнения. По территории в целом: ${percentAll}%.`;
    }
}

// ---------- ОБЯЗАТЕЛЬНЫЕ МЕРОПРИЯТИЯ ----------
function getRequiredEventInfo(eventName) {
    const found = REQUIRED_EVENTS.find(e => e.name === eventName);
    return found ? { isRequired: true, grade: found.grade } : { isRequired: false };
}

function renderRequiredTable() {
    const tbody = document.getElementById('requiredTableBody');
    if (!tbody) return;

    if (REQUIRED_EVENTS.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">Нет обязательных мероприятий</td></tr>';
        return;
    }

    let html = '';
    REQUIRED_EVENTS.forEach(ev => {
        const passed = records.filter(r => r.event === ev.name && r.status === 'Пройдено').length;
        const total = records.filter(r => r.event === ev.name).length;
        const percent = total === 0 ? 0 : Math.round((passed / total) * 100);
        html += `<tr>
            <td>${ev.name}</td>
            <td><span class="badge ${ev.grade === 3 ? 'badge-green' : 'badge-red'}">Грейд ${ev.grade}</span></td>
            <td>${passed}</td>
            <td>${percent}%</td>
        </tr>`;
    });
    tbody.innerHTML = html;
}

// ---------- СТАТИСТИКА ПО СОТРУДНИКУ (НОВАЯ) ----------
function renderEmployeeStats() {
    const wine = document.getElementById('statWineSelect').value;
    const employee = document.getElementById('statEmployeeSelect').value;
    const container = document.getElementById('employeeStatsResult');

    if (!wine || !employee) {
        container.innerHTML = '<p style="color:#8a9aa8;">Выберите винотеку и сотрудника.</p>';
        return;
    }

    const empRecords = records.filter(r => r.wine === wine && r.employee === employee);
    if (empRecords.length === 0) {
        container.innerHTML = `<p>Для сотрудника <strong>${employee}</strong> пока нет записей.</p>`;
        return;
    }

    const total = empRecords.length;
    const done = empRecords.filter(r => r.status === 'Пройдено').length;
    const planned = empRecords.filter(r => r.status === 'Запланировано').length;
    const missed = empRecords.filter(r => r.status === 'Пропущено').length;
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);

    let html = `
        <div class="stat-grid">
            <div class="stat-block"><span class="stat-number">${total}</span><span class="stat-label">Всего записей</span></div>
            <div class="stat-block"><span class="stat-number">${done}</span><span class="stat-label">Пройдено</span></div>
            <div class="stat-block"><span class="stat-number">${planned}</span><span class="stat-label">Запланировано</span></div>
            <div class="stat-block"><span class="stat-number">${missed}</span><span class="stat-label">Пропущено</span></div>
            <div class="stat-block"><span class="stat-number">${percent}%</span><span class="stat-label">% выполнения</span></div>
        </div>
        <h3 style="margin:20px 0 10px;">Обязательные мероприятия</h3>
        <div style="overflow-x:auto;">
            <table>
                <thead><tr><th>Мероприятие</th><th>Грейд</th><th>Статус</th></tr></thead>
                <tbody>
    `;
    REQUIRED_EVENTS.forEach(ev => {
        const rec = empRecords.find(r => r.event === ev.name);
        const status = rec ? rec.status : 'Нет записи';
        let badge = 'badge-gray';
        if (status === 'Пройдено') badge = 'badge-green';
        else if (status === 'Пропущено') badge = 'badge-red';
        html += `<tr>
            <td>${ev.name}</td>
            <td><span class="badge ${ev.grade === 3 ? 'badge-green' : 'badge-red'}">Грейд ${ev.grade}</span></td>
            <td><span class="badge ${badge}">${status}</span></td>
        </tr>`;
    });
    html += `</tbody></table></div>`;

    container.innerHTML = html;
}

// ---------- ЭКСПОРТ В EXCEL (ДЛЯ СОТРУДНИКА) ----------
function exportEmployeeExcel() {
    const wine = document.getElementById('statWineSelect').value;
    const employee = document.getElementById('statEmployeeSelect').value;
    if (!wine || !employee) {
        alert('Сначала выберите винотеку и сотрудника.');
        return;
    }
    const empRecords = records.filter(r => r.wine === wine && r.employee === employee);
    if (empRecords.length === 0) {
        alert('У этого сотрудника нет записей.');
        return;
    }

    const data = empRecords.map(r => ({
        'Винотека': r.wine,
        'Сотрудник': r.employee,
        'Мероприятие': r.event,
        'Тип': r.type,
        'Статус': r.status,
        'Дата': r.date
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Записи');
    XLSX.writeFile(wb, `Статистика_${employee}_${new Date().toISOString().slice(0,10)}.xlsx`);
}

// ---------- ИНИЦИАЛИЗАЦИЯ ВКЛАДКИ СТАТИСТИКИ СОТРУДНИКОВ ----------
function initEmployeeStats() {
    const wineSelect = document.getElementById('statWineSelect');
    const empSelect = document.getElementById('statEmployeeSelect');

    wineSelect.innerHTML = '<option value="">— выберите —</option>';
    WINERIES.forEach(w => {
        const opt = document.createElement('option');
        opt.value = w;
        opt.textContent = w;
        wineSelect.appendChild(opt);
    });

    wineSelect.addEventListener('change', function() {
        const selectedWine = this.value;
        empSelect.innerHTML = '<option value="">— выберите —</option>';
        if (selectedWine && EMPLOYEES[selectedWine]) {
            EMPLOYEES[selectedWine].forEach(emp => {
                const opt = document.createElement('option');
                opt.value = emp;
                opt.textContent = emp;
                empSelect.appendChild(opt);
            });
        }
        document.getElementById('employeeStatsResult').innerHTML = '<p style="color:#8a9aa8;">Выберите сотрудника и нажмите «Показать статистику».</p>';
    });

    document.getElementById('showStatsBtn').addEventListener('click', renderEmployeeStats);
    document.getElementById('exportExcelBtn').addEventListener('click', exportEmployeeExcel);
}

// ---------- АДМИНИСТРИРОВАНИЕ ----------
function adminLogin() {
    const pass = document.getElementById('adminPass').value;
    if (pass === ADMIN_PASSWORD) {
        isAdmin = true;
        document.getElementById('adminStatus').textContent = '✅ Режим администратора активен. Можно удалять записи.';
        document.getElementById('adminStatus').style.color = '#2d6a2d';
        document.getElementById('adminLoginBtn').style.display = 'none';
        document.getElementById('adminLogoutBtn').style.display = 'inline-block';
        renderAdminTable();
    } else {
        document.getElementById('adminStatus').textContent = '❌ Неверный пароль';
        document.getElementById('adminStatus').style.color = '#b13a3a';
    }
}

function adminLogout() {
    isAdmin = false;
    document.getElementById('adminStatus').textContent = '';
    document.getElementById('adminLoginBtn').style.display = 'inline-block';
    document.getElementById('adminLogoutBtn').style.display = 'none';
    document.getElementById('adminTableWrap').style.display = 'none';
}

// ---------- ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК ----------
function initTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const target = this.dataset.tab;
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            contents.forEach(c => c.classList.remove('active'));
            document.getElementById(target).classList.add('active');
        });
    });
}

// ---------- ОБЩАЯ ПЕРЕРИСОВКА ----------
function renderAll() {
    renderTable();
    renderAdminTable();
    updateStats();
    renderRequiredTable();
}

// ---------- ЗАПУСК ----------
document.addEventListener('DOMContentLoaded', function() {
    renderSelects();
    initTabs();
    initEmployeeStats(); // <-- инициализация новой вкладки
    document.getElementById('filterWine').value = '__all';
    loadDataFromFirestore();

    document.getElementById('addBtn').addEventListener('click', addRecord);
    document.getElementById('adminLoginBtn').addEventListener('click', adminLogin);
    document.getElementById('adminLogoutBtn').addEventListener('click', adminLogout);

    document.getElementById('eventInput').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') addRecord();
    });
});
// Переключение темы
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
const themeLabel = document.getElementById('themeLabel');

// Проверка сохранённой темы
if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-theme');
    themeIcon.textContent = '☀️';
    themeLabel.textContent = 'Светлая';
}

themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-theme');
    const isDark = document.body.classList.contains('dark-theme');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    themeIcon.textContent = isDark ? '☀️' : '🌙';
    themeLabel.textContent = isDark ? 'Светлая' : 'Тёмная';
});
