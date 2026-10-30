export type ResumeUpload = {
  originalName: string;
  mimeType: 'application/pdf' | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  buffer: Buffer;
  size: number;
};
