import type { Locale } from './types';

type ExperienceCopy = {
  restoredTitle: string;
  restoredBody: string;
  stored: string;
  storedWithName: string;
  notStored: string;
  corrections: string;
  anotherGuest: string;
  anotherGuestBody: string;
  startAnotherGuest: string;
  cancel: string;
  unconfirmed: string;
  conflict: string;
  closed: string;
  preview: string;
  unavailable: string;
  pendingSaved: string;
  pendingNotSaved: string;
};

export const rsvpExperienceCopy: Record<Locale, ExperienceCopy> = {
  en: {
    restoredTitle: 'RSVP received on this device',
    restoredBody: 'These answers were confirmed earlier in this browser. They may belong to another guest who used this device.',
    stored: 'A confirmation is saved on this device for your next visit. Your personal message is not saved with it.',
    storedWithName: 'Your name and confirmation are saved on this device for your next visit. Your personal message is not saved with them.',
    notStored: 'Your RSVP was received, but this browser could not save the confirmation for your next visit. You can keep a screenshot for your records.',
    corrections: 'To change a response or check an RSVP sent elsewhere, please reply to the original invitation message so we can help.',
    anotherGuest: 'Another guest using this device',
    anotherGuestBody: 'Start a separate RSVP for another guest. The earlier RSVP will remain received; its saved confirmation on this device will be replaced. This does not change the earlier response.',
    startAnotherGuest: 'Start another guest’s RSVP',
    cancel: 'Keep this confirmation',
    unconfirmed: 'We could not confirm whether your RSVP reached us. Your answers are kept unchanged so you can safely try sending again. To change them, please reply to the original invitation message.',
    conflict: 'An earlier RSVP was received with different answers. Please reply to the original invitation message to check or change it. Sending again here could create a separate response.',
    closed: 'Online RSVP has closed. Your answers remain on this page. Please reply to the original invitation message for help with your response.',
    preview: 'RSVP is not open yet. Your answers remain on this page; please return when responses open.',
    unavailable: 'Online RSVP is temporarily unavailable. Your answers remain on this page. Please try again later, or reply to the original invitation message for help.',
    pendingSaved: 'This attempted response is saved on this device. Keep these answers unchanged while checking whether it was received.',
    pendingNotSaved: 'This browser could not save your attempted response. Keep this page open to retry the same answers, or reply to the original invitation message for help.',
  },
  ms: {
    restoredTitle: 'RSVP diterima pada peranti ini',
    restoredBody: 'Jawapan ini telah disahkan sebelum ini melalui pelayar ini. Jawapan ini mungkin milik tetamu lain yang menggunakan peranti ini.',
    stored: 'Pengesahan disimpan pada peranti ini untuk lawatan seterusnya. Ucapan peribadi anda tidak disimpan bersamanya.',
    storedWithName: 'Nama dan pengesahan anda disimpan pada peranti ini untuk lawatan seterusnya. Ucapan peribadi anda tidak disimpan bersamanya.',
    notStored: 'RSVP anda telah diterima, tetapi pelayar ini tidak dapat menyimpan pengesahan untuk lawatan seterusnya. Anda boleh menyimpan tangkap layar sebagai rekod.',
    corrections: 'Untuk mengubah jawapan atau menyemak RSVP yang dihantar melalui peranti lain, sila balas mesej jemputan asal supaya kami dapat membantu.',
    anotherGuest: 'Tetamu lain menggunakan peranti ini',
    anotherGuestBody: 'Mulakan RSVP berasingan untuk tetamu lain. RSVP terdahulu kekal diterima; pengesahan tersimpannya pada peranti ini akan digantikan. Ini tidak mengubah jawapan terdahulu.',
    startAnotherGuest: 'Mulakan RSVP tetamu lain',
    cancel: 'Kekalkan pengesahan ini',
    unconfirmed: 'Kami tidak dapat mengesahkan sama ada RSVP anda telah diterima. Jawapan anda dikekalkan supaya selamat untuk dihantar semula. Untuk mengubahnya, sila balas mesej jemputan asal.',
    conflict: 'RSVP terdahulu telah diterima dengan jawapan yang berbeza. Sila balas mesej jemputan asal untuk menyemak atau mengubahnya. Penghantaran semula di sini boleh mewujudkan jawapan berasingan.',
    closed: 'RSVP dalam talian telah ditutup. Jawapan anda masih ada pada halaman ini. Sila balas mesej jemputan asal untuk bantuan.',
    preview: 'RSVP belum dibuka. Jawapan anda masih ada pada halaman ini; sila kembali apabila RSVP dibuka.',
    unavailable: 'RSVP dalam talian tidak tersedia buat sementara waktu. Jawapan anda masih ada pada halaman ini. Sila cuba lagi kemudian atau balas mesej jemputan asal untuk bantuan.',
    pendingSaved: 'Jawapan yang cuba dihantar disimpan pada peranti ini. Kekalkan jawapan ini semasa menyemak sama ada RSVP telah diterima.',
    pendingNotSaved: 'Pelayar ini tidak dapat menyimpan jawapan yang cuba dihantar. Kekalkan halaman ini untuk mencuba jawapan yang sama, atau balas mesej jemputan asal untuk bantuan.',
  },
};
