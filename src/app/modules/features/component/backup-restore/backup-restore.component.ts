import { Component, OnInit } from '@angular/core';
import { BackupRestoreService, BackupData } from '../../../../util/service/db/backup-restore.service';
import { NotificationService } from '../../../../util/service/notification.service';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../../../../util/components/confirm-dialog/confirm-dialog.component';
import { TranslateService } from '@ngx-translate/core';

@Component({
    selector: 'app-backup-restore',
    templateUrl: './backup-restore.component.html',
    styleUrls: ['./backup-restore.component.scss']
})
export class BackupRestoreComponent implements OnInit {
    isLoading = false;
    selectedFile: File | null = null;
    importSummary: any = null;

    constructor(
        private backupRestoreService: BackupRestoreService,
        private notificationService: NotificationService,
        private dialog: MatDialog,
        private translate: TranslateService
    ) { }

    ngOnInit(): void { }

    async onExport(): Promise<void> {
        this.isLoading = true;
        try {
            await this.backupRestoreService.exportData();
            this.notificationService.success('BACKUP.EXPORT_SUCCESS');
        } catch (error) {
            console.error('Export failed:', error);
            this.notificationService.error('BACKUP.EXPORT_FAILED');
        } finally {
            this.isLoading = false;
        }
    }

    onFileSelected(event: any): void {
        const file = event.target.files[0];
        if (file) {
            if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
                this.notificationService.error('BACKUP.INVALID_FILE_TYPE');
                return;
            }
            this.selectedFile = file;
        }
    }

    async onImport(mode: 'replace' | 'merge'): Promise<void> {
        if (!this.selectedFile) return;

        const confirmTitle = mode === 'replace' ? 'BACKUP.CONFIRM_REPLACE_TITLE' : 'BACKUP.CONFIRM_MERGE_TITLE';
        const confirmMsg = mode === 'replace' ? 'BACKUP.CONFIRM_REPLACE_MSG' : 'BACKUP.CONFIRM_MERGE_MSG';

        const dialogRef = this.dialog.open(ConfirmDialogComponent, {
            width: '400px',
            data: {
                title: this.translate.instant(confirmTitle),
                message: this.translate.instant(confirmMsg),
                confirmText: this.translate.instant('COMMON.PROCEED'),
                cancelText: this.translate.instant('COMMON.CANCEL'),
                confirmColor: mode === 'replace' ? 'warn' : 'primary'
            }
        });

        dialogRef.afterClosed().subscribe(async result => {
            if (result) {
                this.isLoading = true;
                try {
                    const reader = new FileReader();
                    reader.onload = async (e: any) => {
                        try {
                            const backup = JSON.parse(e.target.result) as BackupData;
                            const response = await this.backupRestoreService.importData(backup, mode);
                            if (response.success) {
                                this.notificationService.success(response.message);
                                this.importSummary = response.summary;
                            } else {
                                this.notificationService.error(response.message);
                            }
                        } catch (err) {
                            this.notificationService.error('BACKUP.PARSE_ERROR');
                        } finally {
                            this.isLoading = false;
                        }
                    };
                    reader.readAsText(this.selectedFile!);
                } catch (error) {
                    this.notificationService.error('BACKUP.IMPORT_FAILED');
                    this.isLoading = false;
                }
            }
        });
    }
}
