# Windows install-over 2.1.3 — verification

## Result

Candidate EXE built from 5eceb3f178e57f8d18c7f09cb3dd74e2a999ea72.
Verification harness: 4726ae0904b60190d964caaa9fdfafd634f64865.
SHA256: f4b04821d7d90784c7f55c97b6d1d8defb1db1fc6276fd50c76d662b0488c304.
Size: 125773454 bytes.

All five Windows jobs passed:
https://github.com/nutricionistaalmeidavh-spec/OBRANAMAOCOMERCIAL/actions/runs/38993753950

The workflow checks that packaged production directories have not changed and verifies the exact EXE hash before executing the scenarios. This is the same binary supplied for manual installation.

## Reproduced failure and correction

The stock NSIS upgrade invokes the previous uninstaller. Real Windows reproduction showed that documents stored inside the installation directory can be removed while the AppData SQLite database and configured UNC document root remain. A missing SMB share base then reproduces the startup mkdir exception. Separately, a retained shortcut can launch a separate legacy executable. These are demonstrated failure paths; the customer's filesystem was not available to establish which path occurred on that machine.

The NSIS include overlay installs the payload over the existing directory without invoking the old uninstaller or recursively deleting installation contents. It updates install registry information, recreates shortcuts, and launches the newly installed executable directly. The existing 2.1.2 runtime behavior for an unavailable document root remains: startup succeeds and reports the unavailable configured root without silently replacing it.

## Windows matrix

| Scenario | Actual operation | Verified result |
| --- | --- | --- |
| inside-canonical | 2.0.0 public updater to candidate; documents under installation | Opens, document hash preserved, canonical DB records preserved |
| inside-nested | Same update; SMB share base nested inside installation | Opens, document hash preserved, canonical DB records preserved |
| external-canonical | Same update; documents outside installation | Opens, document hash preserved, canonical DB records preserved |
| inside-stale | Same update with shortcut targeting a separate 1.0.18 copy | Newly installed EXE opens; shortcut repaired; documents preserved |
| broken-share | Stock 2.1.1 creates real startup mkdir failure; install candidate over it | Opens, original root retained and reported unavailable; DB records preserved |

Each scenario installs the candidate again and verifies repeat startup. Healthy cases verify real standard-user document access, original hash, root configuration, company, SQLite integrity, file record, and document reference. Broken-share deliberately starts with the physical document already missing: no claim of undelete or restored access is made.

The full installed Electron shell and real IPC/bootstrap were exercised with existing QA environment flags, without real customer authentication. Windows filesystem, SMB shares, native installers and updater are real; no filesystem error was injected.

## Other checks

Packaging run:
https://github.com/nutricionistaalmeidavh-spec/OBRANAMAOCOMERCIAL/actions/runs/38985595888

Packaging job passed lint/build, 521 desktop tests and 273 LAN tests. Its original matrix failed because of two verification-harness issues (Python tuple/list comparison and an overly strict error-code expectation); these were corrected in the subsequent green verification without changing the packaged production source.

## Delivery and limits

Install 2.1.3 over the existing installation, with the app closed, retaining the existing Windows account and install location. Do not uninstall first. Back up the database and remaining documents before working on client machines.

Files already erased by an earlier installer require backup or separate recovery; this EXE prevents further upgrade deletion and allows startup with an unavailable root. A still-unavailable share must be repaired before those documents can be accessed.

No production release, main merge or automatic-update publication was performed. Changes remain on fix/windows-update-data-preservation-20261016.
