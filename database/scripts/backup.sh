# Create a backup directory in your user's home folder
BACKUP_DIR="$HOME/Backups"
DATABASE_NAME="redcliffrecord"
mkdir -p "$BACKUP_DIR"

# Get current date for filename
DATE=$(date +%Y-%m-%d-%H-%M-%S)
BACKUP_FILE="$BACKUP_DIR/$DATABASE_NAME-backup-$DATE.dump"

# Set password and run backup
pg_dump -h localhost -U postgres -d $DATABASE_NAME --clean --format=c --schema=* -f "$BACKUP_FILE"

echo "Backup created at: $BACKUP_FILE"