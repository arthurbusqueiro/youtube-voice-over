import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  imports: [FormsModule, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly title = signal('Youtube Voice Over');
  youtubeUrl = '';
  language = 'en';
  processing = false;
  jobId = '';
  videoUrl = '';
  error = '';
  jobStatus = '';
  pollInterval: any;

  languages = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'pt', name: 'Portuguese' },
  ];

  constructor(private http: HttpClient) {}

  handleSubmit() {
    if (!this.youtubeUrl) return;
    this.processing = true;
    this.error = '';
    this.videoUrl = '';
    this.jobStatus = '';
    this.jobId = '';

    this.http
      .post<ProcessResponse>(environment.apiUrl + '/process', {
        youtubeUrl: this.youtubeUrl,
        language: this.language,
      })
      .subscribe({
        next: (res) => {
          this.jobId = res.jobId;
          this.jobStatus = 'pending';
          this.pollJobStatus();
        },
        error: (err) => {
          this.error = 'Processing failed: ' + (err.error?.message || err.message);
          this.processing = false;
        },
      });
  }

  pollJobStatus() {
    this.pollInterval = setInterval(() => {
      this.http.get<JobStatus>(`${environment.apiUrl}/job/${this.jobId}`).subscribe({
        next: (job) => {
          this.jobStatus = job.status;
          if (job.status === 'done' && job.result?.videoUrl) {
            this.videoUrl = job.result.videoUrl;
            this.processing = false;
            clearInterval(this.pollInterval);
          } else if (job.status === 'error') {
            this.error = job.error || 'Unknown error';
            this.processing = false;
            clearInterval(this.pollInterval);
          }
        },
        error: () => {
          this.error = 'Failed to fetch job status.';
          this.processing = false;
          clearInterval(this.pollInterval);
        },
      });
    }, 2000);
  }
}

interface ProcessResponse {
  jobId: string;
  videoUrl?: string;
}

interface JobStatus {
  status: string;
  result?: { videoUrl: string };
  error?: string;
}
