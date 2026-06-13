export function getFileName(planName : string): string {

    const date: Date = new Date();

    const year: number = date.getFullYear();
    // getMonth() is 0-indexed (0 = January), so add 1
    const month: string = String(date.getMonth() + 1).padStart(2, '0');
    const day: string = String(date.getDate()).padStart(2, '0');

    const customDateStr: string = `${year}-${month}-${day}`;

    return planName+"-"+customDateStr;
}