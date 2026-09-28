// Konfigurasi e-Learning SMK Bina Rahayu (Moodle).
export const ELEARNING = {
  name: 'e-Learning SMK Bina Rahayu',
  baseUrl: (process.env.ELEARNING_BASE_URL || 'https://e-learning.smkbinarahayu.sch.id').replace(/\/$/, ''),
  loginUrl: '/login/index.php',
  dashboardUrl: '/my/',
  profileUrl: '/user/profile.php',
  changePasswordUrl: '/login/change_password.php',
  quizUrlTemplate: '/mod/quiz/view.php?id={id}',
};

// Daftar mapel/kuis yang diatur guru (opsional), env MAPEL_LIST berisi JSON, contoh:
// [{"id":123,"nama":"Matematika - UH 1"},{"id":456,"nama":"Bahasa Indonesia - UTS"}]
export function mapelList() {
  try {
    const a = JSON.parse(process.env.MAPEL_LIST || '[]');
    return (Array.isArray(a) ? a : [])
      .filter((m) => /^\d{1,10}$/.test(String(m.id)) && m.nama)
      .map((m) => ({ id: String(m.id), nama: String(m.nama).slice(0, 80) }));
  } catch { return []; }
}

export const links = () => ({
  dashboard: ELEARNING.baseUrl + ELEARNING.dashboardUrl,
  changePassword: ELEARNING.baseUrl + ELEARNING.changePasswordUrl,
});
