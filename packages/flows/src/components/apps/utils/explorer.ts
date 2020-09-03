import { homedir } from "os";
import { File } from "@web-desktop-environment/interfaces/lib/views/apps/utils/Explorer";
import * as fs from "fs-extra";
import { join, sep } from "path";
import { App } from "@apps/index";
import { windowContext } from "@desktop/window";

interface ExplorerInput {
	path?: string;
}

const terminalFlow = <App<ExplorerInput>["flow"]>(async ({
	view,
	views,
	getContext,
	input: { path: startingPath = homedir(), desktopManager, parentLogger },
}) => {
	const logger = parentLogger.mount("explorer");
	let currentPath = startingPath;
	const listFiles = async (): Promise<File[]> => {
		const filesNames = await fs.readdir(currentPath);
		const files = await filesNames.map(
			async (file): Promise<File> => {
				try {
					const stat = await fs.stat(join(currentPath, file));
					return {
						isFolder: stat.isDirectory(),
						name: file,
						size: stat.size,
						time: stat.atime.getTime(),
					};
				} catch {
					return;
				}
			}
		);
		return (await Promise.all(files)).filter((file) => file);
	};
	const explorer = view(0, views.explorer, {
		currentPath,
		platfromPathSperator: sep as "/" | "\\",
		files: await listFiles(),
		type: "explore",
	});
	const window = getContext(windowContext);
	if (window) window.setWindowTitle(`explorer - ${currentPath}`);
	let isUpdatingFiles = false;
	const updateFiles = async () => {
		if (!isUpdatingFiles) {
			isUpdatingFiles = true;
			explorer.update({ files: await listFiles() });
			isUpdatingFiles = false;
		}
	};
	explorer
		.on("changeCurrentPath", async (path) => {
			currentPath = path;
			if (window) window.setWindowTitle(`explorer - ${currentPath}`);
			explorer.update({
				currentPath,
				files: await listFiles(),
			});
		})
		.on("createFolder", async (file) => {
			await fs.mkdir(file);
			await updateFiles();
		})
		.on("delete", async (file) => {
			await fs.remove(file);
			await updateFiles();
		})
		.on("move", async ({ newPath, originalPath }) => {
			await fs.move(originalPath, newPath);
			await updateFiles();
		})
		.on("copy", async ({ newPath, originalPath }) => {
			await fs.copy(originalPath, newPath);
			await updateFiles();
		})
		.on("upload", async ({ data, path }) => {
			await fs.writeFile(path, data);
			await updateFiles();
		})
		.on("requestDownloadLink", async (path) => {
			const hash = desktopManager.downloadManager.addFile(path);
			logger.info(
				`user request download link for ${path} secret hash is ${hash}`
			);
			return {
				path: `/${hash}`,
				port: desktopManager.downloadManager.port,
			};
		});
	await explorer;
});

export const explorer: App<ExplorerInput> = {
	name: "Explorer",
	description: "a file explorer",
	flow: terminalFlow,
	defaultInput: {},
	icon: {
		type: "icon",
		icon: "BsFillFolderFill",
	},
	nativeIcon: {
		icon: "folder-multiple",
		type: "MaterialCommunityIcons",
	},
	window: {
		height: 600,
		width: 720,
		position: { x: 150, y: 150 },
		maxHeight: 800,
		maxWidth: 1200,
		minHeight: 450,
		minWidth: 600,
	},
};