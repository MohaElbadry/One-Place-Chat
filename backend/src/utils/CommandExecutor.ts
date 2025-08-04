import { exec } from 'child_process';
import { promisify } from 'util';

export class CommandExecutor {
    private execAsync = promisify(exec);

    async executeCurl(curlCommand: string): Promise<string> {
        try {
            const { stdout, stderr } = await this.execAsync(curlCommand);
            
            if (stderr) {
                console.error('Command stderr:', stderr);
            }
            
            return stdout;
        } catch (error: any) {
            console.error('Error executing command:', error.message);
            if (error.stdout) console.error('Command output:', error.stdout);
            if (error.stderr) console.error('Command error:', error.stderr);
            throw error;
        }
    }
}
